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
        edges = separateToEdges(normalized),
        rects = buildRects(edges);
    return [...annotateRects(rects, items)];
}

const EPSILON = 0.01;
const THRESHOLD = 2;

function equals(v: vec2, w: vec2) {
    return vec2.distance(v, w) < THRESHOLD;
}

function cross(v: vec2, w: vec2) {
    return v[0] * w[1] - v[1] * w[0];
}

function getCrossingPoint(l1: Edge, l2: Edge): vec2|undefined {
    const
        v0 = vec2.subtract(vec2.create(), l2.start, l1.start),
        v1 = vec2.subtract(vec2.create(), l1.end, l1.start),
        v2 = vec2.subtract(vec2.create(), l2.end, l2.start),
        t1 = cross(v2, v0) / cross(v2, v1),
        t2 = cross(v1, v0) / cross(v2, v1);
    if ((-EPSILON < t1 && t1 < 1 + EPSILON && 0 < t2 && t2 < 1) ||
        (-EPSILON < t2 && t2 < 1 + EPSILON && 0 < t1 && t1 < 1)) {
        return vec2.scaleAndAdd(vec2.create(), l1.start, v1, t1);
    }
    return;
}

function* normalizeLines(lines: Iterable<Edge>): IterableIterator<Edge> {
    for (const line of lines) {
        if (Math.abs(line.start[0] - line.end[0]) < THRESHOLD) {
            // vertical line
            // order by Y
            yield line.start[1] < line.end[1]
                ? line
                : { start: line.end, end: line.start };
        } else if (Math.abs(line.start[1] - line.end[1]) < THRESHOLD) {
            // horizontal line
            // order by X
            yield line.start[0] < line.end[0]
                ? line
                : { start: line.end, end: line.start };
        }
    }
}

export function separateToEdges(lines: Iterable<Edge>): Edge[] {
    function split(edge: Edge, p: vec2): [Edge, Edge] {
        return [
            { start: edge.start, end: p },
            { start: p, end: edge.end }
        ];
    }

    let results: Edge[] = [...lines];
    while (true) {
        const candidates: Edge[] = [];
        const add = (l1: Edge) => {
            if (equals(l1.start, l1.end)) {
                return;
            }
            if (candidates.some(l2 => equals(l1.start, l2.start) && equals(l1.end, l2.end))) {
                return;
            }
            candidates.push(l1);
        };

        // filter short edges and the same edges
        results.forEach(add);
        results = [...candidates];

        // split edges by the crossing points
        for (const l1 of results) {
            for (const l2 of results) {
                const p = getCrossingPoint(l1, l2);
                if (p) {
                    split(l1, p).forEach(add);
                    split(l2, p).forEach(add);
                }
            }
        }
        if (results.length === candidates.length) {
            return results;
        }
        results = candidates;
    }
}

export function* buildRects(edges: Edge[]): IterableIterator<Rect> {
    for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
        // ignore [l1, l2] and [l2, l1] order difference
        // to treat [l1, l2, l3, l4] and [l2, l1, l4, l3] as the same Rect
        const l1 = edges[i];
        const l2 = edges[j];

        if (equals(l1.start, l2.start)) {
            // area of rectangle >= THRESHOLD
            const area = cross(
                vec2.subtract(vec2.create(), l1.end, l1.start),
                vec2.subtract(vec2.create(), l2.end, l2.start)
            );
            if (Math.abs(area) > THRESHOLD) {
                for (const l3 of edges)
                if (equals(l1.end, l3.start))
                for (const l4 of edges)
                if (equals(l2.end, l4.start))
                if (equals(l3.end, l4.end))
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
