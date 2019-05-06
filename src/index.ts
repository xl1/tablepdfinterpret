import { vec2, mat2d } from 'gl-matrix';
import * as pdfjs from 'pdfjs-dist';
import { Edge, Rect, TextRect } from './models';
import OPS from './ops';

export default async function(source: Uint8Array|pdfjs.PDFDocumentProxy, {
    pageNumber = 1,
} = {}): Promise<TextRect[]> {
    const
        pdf = source instanceof Uint8Array
            ? await pdfjs.getDocument(source).promise
            : source,
        page = await pdf.getPage(pageNumber),
        { fnArray, argsArray } = await page.getOperatorList(),
        { items } = await page.getTextContent(),
        lines = extractLines(fnArray, argsArray),
        normalized = normalizeLines(lines),
        edges = separateToEdges(...normalized),
        rects = buildRects(...edges);
    return [...annotateRects(rects, items)];
}

const THRESHOLD = 2;

function equals(v: vec2, w: vec2) {
    return Math.abs(v[0] - w[0]) < THRESHOLD
        && Math.abs(v[1] - w[1]) < THRESHOLD;
}

function getCrossingPoint(v: Edge, h: Edge): vec2|undefined {
    if (v.start[1] - THRESHOLD < h.start[1] && h.start[1] < v.end[1] + THRESHOLD &&
        h.start[0] - THRESHOLD < v.start[0] && v.start[0] < h.end[0] + THRESHOLD) {
        return vec2.fromValues(v.start[0], h.start[1]);
    }
}

function normalizeLines(lines: Iterable<Edge>): [Edge[], Edge[]] {
    const vertical: Edge[] = [];
    const horizontal: Edge[] = [];
    for (const line of lines) {
        const dx = line.start[0] - line.end[0];
        const dy = line.start[1] - line.end[1];
        if (Math.abs(dx) < THRESHOLD) {
            vertical.push(dy < 0 ? line : { start: line.end, end: line.start });
        } else if (Math.abs(dy) < THRESHOLD) {
            horizontal.push(dx < 0 ? line : { start: line.end, end: line.start });
        }
    }
    return [vertical, horizontal];
}

export function separateToEdges(vertical: Iterable<Edge>, horizontal: Iterable<Edge>): [Edge[], Edge[]] {
    const verticalResult: Edge[] = [];
    const horizontalResult: Edge[] = [];
    const add = (e: Edge, array: Edge[]) => {
        if (equals(e.start, e.end)) return;
        if (array.some(x => equals(e.start, x.start) && equals(e.end, x.end))) return;
        array.push(e);
    };

    for (const e of vertical) add(e, verticalResult);
    for (const e of horizontal) add(e, horizontalResult);
    for (const v of verticalResult) {
        for (const h of horizontal) {
            const p = getCrossingPoint(v, h);
            if (p) {
                add({ start: v.start, end: p }, verticalResult);
                add({ start: p, end: v.end }, verticalResult);
            }
        }
    }
    for (const v of vertical) {
        for (const h of horizontalResult) {
            const p = getCrossingPoint(v, h);
            if (p) {
                add({ start: h.start, end: p }, horizontalResult);
                add({ start: p, end: h.end }, horizontalResult);
            }
        }
    }
    return [verticalResult, horizontalResult];
}

export function* buildRects(vertical: Edge[], horizontal: Edge[]): IterableIterator<Rect> {
    const startPairs: [Edge, Edge][] = [];
    const endPairs: [Edge, Edge][] = [];

    for (const l1 of vertical) {
        for (const l2 of horizontal) {
            if (equals(l1.start, l2.start)) {
                startPairs.push([l1, l2]);
            } else if (equals(l1.end, l2.end)) {
                endPairs.push([l1, l2]);
            }
        }
    }

    for (const [l1, l2] of startPairs) {
        for (const [l3, l4] of endPairs) {
            if (equals(l1.end, l4.start) && equals(l2.end, l3.start)) {
                yield { lb: l1.start, rt: l4.end };
            }
        }
    }
}

function* annotateRects(rects: Iterable<Rect>, texts: pdfjs.TextContentItem[])
    : IterableIterator<TextRect> {
    for (const rect of rects) {
        const strings: string[] = [];
        for (const text of texts) {
            const tx = text.transform[4], ty = text.transform[5];
            if (rect.lb[0] <= tx && tx <= rect.rt[0] &&
                rect.lb[1] <= ty && ty <= rect.rt[1]) {
                strings.push(text.str);
            }
        }
        yield {
            strings,
            left: rect.lb[0],
            bottom: rect.lb[1],
            right: rect.rt[0],
            top: rect.rt[1],
        };
    }
}

function* extractLines(fnArray: OPS[], argsArray: any[]): IterableIterator<Edge> {
    let currentMatrix = mat2d.create();
    let currentPoint: vec2|undefined;
    const matStack: mat2d[] = [];
    const vec = (x: number, y: number) =>
        vec2.transformMat2d(vec2.create(), vec2.fromValues(x, y), currentMatrix);
    const rect = ([x, y, w, h]: number[]) => {
        const p1 = vec(x + 0, y + 0);
        const p2 = vec(x + w, y + 0);
        const p3 = vec(x + 0, y + h);
        const p4 = vec(x + y, w + h);
        return [
            { start: p1, end: p2 },
            { start: p1, end: p3 },
            { start: p2, end: p4 },
            { start: p3, end: p4 }
        ];
    }

    for (let i = 0; i < fnArray.length; i++) {
        const args = argsArray[i];
        switch (fnArray[i]) {
            case OPS.save:
                matStack.push(mat2d.clone(currentMatrix));
                break;
            case OPS.restore:
                if (matStack.length)
                    currentMatrix = matStack.pop()!;
                break;
            case OPS.transform:
                const [a, b, c, d, tx, ty] = args;
                mat2d.multiply(currentMatrix, currentMatrix, mat2d.fromValues(a, b, c, d, tx, ty));
                break;
            case OPS.moveTo:
                currentPoint = vec(args[0], args[1]);
                break;
            case OPS.lineTo:
                const p = vec(args[0], args[1]);
                if (currentPoint) {
                    yield { start: currentPoint, end: p };
                }
                currentPoint = p;
                break;
            case OPS.rectangle:
                yield* rect(args);
                break;
            case OPS.constructPath:
                const subFn: OPS[] = [...args[0]]; // clone
                const subArgs: number[] = [...args[1]]; // clone
                let fn: OPS|undefined;
                while (fn = subFn.shift()) {
                    if (fn === OPS.moveTo) {
                        currentPoint = vec(subArgs.shift()!, subArgs.shift()!);
                    } else if (fn === OPS.lineTo) {
                        const p = vec(subArgs.shift()!, subArgs.shift()!);
                        if (currentPoint) {
                            yield { start: currentPoint, end: p };
                        }
                        currentPoint = p;
                    } else if (fn === OPS.rectangle) {
                        yield* rect(subArgs.splice(0, 4));
                    }
                }
                break;
        }
    }
}
