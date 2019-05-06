import { vec2, mat2d } from 'gl-matrix';
import * as pdfjs from 'pdfjs-dist';
import { Edge, Rect, TextRect, Neighbor } from './models';
import OPS from './ops';
import Sorted from "./Sorted";

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
        [vertical, horizontal] = normalizeLines(lines),
        graph = constructGraph(vertical, horizontal),
        rects = buildRects(graph);
    return [...annotateRects(rects, items)];
}

const EPSILON = 0.01;
const THRESHOLD = 2;

function equals(v: vec2, w: vec2) {
    return Math.abs(v[0] - w[0]) < THRESHOLD
        && Math.abs(v[1] - w[1]) < THRESHOLD;
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

function constructGraph(vertical: Iterable<Edge>, horizontal: Iterable<Edge>): Map<vec2, Neighbor> {
    const result = new Map<vec2, Neighbor>();

    for (const v of vertical) {
        const ps = new Sorted<vec2>();
        for (const h of horizontal) {
            const p = getCrossingPoint(v, h);
            if (p) ps.add(p[1], p);
        }
        for (let i = 0, j = 1; j < ps.values.length; j++) {
            if (ps.keys[j] - ps.keys[i] > THRESHOLD) {
                result.set(ps.values[i], { up: ps.values[j] });
                i = j;
            }
        }
    }

    for (const h of horizontal) {
        const ps = new Sorted<vec2>();
        for (const v of vertical) {
            const p = getCrossingPoint(v, h);
            if (p) ps.add(p[0], p);
        }
        for (let i = 0, j = 1; j < ps.values.length; j++) {
            if (ps.keys[j] - ps.keys[i] > THRESHOLD) {
                result.set(ps.values[i], { right: ps.values[j] });
                i = j;
            }
        }
    }

    // merge same nodes
    const filtered = new Map<vec2, Neighbor>();
    for (let [p, value] of result) {
        for (const [q, newValue] of filtered) {
            if (equals(p, q)) {
                p = q;
                value = { ...value, ...newValue };
                break;
            }
        }
        filtered.set(p, value);
    }

    return filtered;
}

export function* buildRects(graph: Map<vec2, Neighbor>): IterableIterator<Rect> {
    function get(p: vec2): Neighbor|undefined {
        for (const [k, v] of graph) {
            if (equals(k, p)) return v;
        }
    }

    function findNext(
        p: vec2,
        next: (n: Neighbor) => vec2|undefined,
        predicate: (p: vec2, n: Neighbor|undefined) => boolean
    ) {
        for (const q of enumerateAll(p, next)) {
            if (predicate(q, get(q))) return q;
        }
    }

    function* enumerateAll(p: vec2|undefined, next: (n: Neighbor) => vec2|undefined) {
        while (p) {
            yield p;
            const neighbor = get(p);
            if (!neighbor) break;
            p = next(neighbor);
        }
    }

    for (const [lb, { up, right }] of graph) {
        if (up && right) {
            const rb = findNext(right, n => n.right, (p, n) => !!(n && n.up));
            const lt = findNext(up, n => n.up, (p, n) => !!(n && n.right));
            if (rb && lt) {
                const rightLine = [...enumerateAll(rb, n => n.up)];
                const rt = findNext(lt, n => n.right, p => rightLine.some(q => equals(p, q)));
                if (rt) {
                    yield { lb, rt };
                }
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
