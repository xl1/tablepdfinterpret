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

const EPSILON = 0.001;
const THRESHOLD = 2;

function equals(v: vec2, w: vec2) {
    return vec2.distance(v, w) < THRESHOLD;
}

function getCrossingPoint(l1: Edge, l2: Edge): vec2|undefined {
    const
        cross = (v: vec2, w: vec2) => v[0] * w[1] - v[1] * w[0],
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

function separateToEdges(lines: Iterable<Edge>): Edge[] {
    function split(edge: Edge, p: vec2): [Edge, Edge] {
        return [
            { start: edge.start, end: p },
            { start: p, end: edge.end }
        ];
    }

    function next(c: Edge, results: Edge[]): [Edge[], Edge[]] {
        if (equals(c.start, c.end)) {
            // do not use c
            return [[], results];
        }
        for (let i = 0; i < results.length; i++) {
            const e = results[i];
            if (equals(e.start, c.start) && equals(e.end, c.end)) {
                // do not use c
                return [[], results];
            }
            const p = getCrossingPoint(e, c);
            if (p) {
                // remove e from result
                results.splice(i, 1);
                // add split(e) and split(c) to candidates
                return [split(e, p).concat(split(c, p)), results];
            }
        }
        results.push(c);
        return [[], results];
    }

    let candidates: Edge[] = [...lines];
    let results: Edge[] = [];
    while (candidates.length) {
        const newCandidates = [];
        for (const c of candidates) {
            const [add, newResults] = next(c, results);
            newCandidates.push(...add);
            results = newResults;
        }
        candidates = newCandidates;
    }
    return results;
}

function* buildRects(edges: Edge[]): IterableIterator<Rect> {
    for (const l1 of edges)
    for (const l2 of edges)
    if (equals(l1.start, l2.start))
    for (const l3 of edges)
    if (equals(l1.end, l3.start))
    for (const l4 of edges)
    if (equals(l2.end, l4.start))
    if (equals(l3.end, l4.end))
        yield { lb: l1.start, rt: l4.end };
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
            case OPS.constructPath:
                const [subFn, subArgs] = args;
                for (let j = 0; j < subFn.length; j++) {
                    if (subFn[j] === OPS.moveTo) {
                        currentPoint = vec(subArgs[j * 2], subArgs[j * 2 + 1]);
                    } else if (subFn[j] === OPS.lineTo) {
                        const p = vec(subArgs[j * 2], subArgs[j * 2 + 1]);
                        if (currentPoint) {
                            yield { start: currentPoint, end: p };
                        }
                        currentPoint = p;
                    }
                }
                break;
        }
    }
}
