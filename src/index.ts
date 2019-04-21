import fetch from 'node-fetch';
import { vec2, mat2d } from 'gl-matrix';
import * as pdfjs from 'pdfjs-dist';
import OPS from './ops';

const url = 'https://gist.githubusercontent.com/xl1/8356b0df9630c91191cd8886604fbecc/raw/test.pdf';

async function main() {
    const pdfData = await fetch(url).then(r => r.arrayBuffer());
    console.log('fetched');

    const pdf = await pdfjs.getDocument(new Uint8Array(pdfData)).promise;
    const page = await pdf.getPage(1);
    console.log('page loaded');

    const { fnArray, argsArray } = await page.getOperatorList();
    const { items } = await page.getTextContent();

    const vertices = enumerateVertices(fnArray, argsArray);
    const labels = enumerateLabels(Array.from(vertices), items);

    for (const label of labels) {
        console.log(label.name, label.rank, label.top, label.bottom);
    }
}

main().catch(console.error);

function* pairwise(iterable : Iterable<number>): IterableIterator<vec2> {
    const iter = iterable[Symbol.iterator]();
    while (true) {
        const x = iter.next();
        if (x.done) break;
        const y = iter.next();
        if (y.done) break;
        yield vec2.fromValues(x.value, y.value);
    }
}

function* enumerateVertices(fnArray: OPS[], argsArray: any[]): IterableIterator<vec2> {
    let currentMatrix = mat2d.create();
    const matStack: mat2d[] = [];

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
            case OPS.lineTo:
                for (const vec of pairwise(args))
                    yield vec2.transformMat2d(vec2.create(), vec, currentMatrix);
                break;
            case OPS.constructPath:
                for (const vec of pairwise(args[1]))
                    yield vec2.transformMat2d(vec2.create(), vec, currentMatrix);
                break;
        }
    }
}

function* groupByThreshold<T>(array: T[], fn: (x: T) => number, threshold: number): IterableIterator<T[]> {
    if (array.length === 0) return;

    array.sort((a, b) => fn(a) - fn(b));
    let group: T[] = [];
    let groupKey: number = fn(array[0]);
    for (const x of array) {
        const key = fn(x);
        if (key - groupKey < threshold) {
            group.push(x);
        } else {
            yield group;
            group = [x];
            groupKey = key;
        }
    }
    yield group;
}

interface Label {
    name: string;
    rank: number;
    top: number;
    bottom: number;
}

function* enumerateLabels(vertices: vec2[], items: pdfjs.TextContentItem[]): IterableIterator<Label> {
    // X 座標が近いものをまとめる
    const vertexGroupingThreshold = 2;
    const vertexGroups = groupByThreshold(vertices, v => v[0], vertexGroupingThreshold);

    const textItemGroupingThreshold = 10;
    const textItemGroups = groupByThreshold(items, t => t.transform[4], textItemGroupingThreshold);

    let rank = 0;
    const vertexGroup: vec2[] = [];
    for (const textItemGroup of textItemGroups) {
        rank++;
        // 頂点追加
        vertexGroup.push(...vertexGroups.next().value);
        // Y 座標でソート
        vertexGroup.sort((a, b) => a[1] - b[1]);

        for (const textItem of textItemGroup) {
            const ty: number = textItem.transform[5];
            // Y 座標が text より高い位置にある最初の頂点
            const topIndex = vertexGroup.findIndex(([x, y]) => y > ty);
            yield {
                name: textItem.str,
                rank: rank,
                top: vertexGroup[topIndex][1],
                bottom: vertexGroup[topIndex - 1][1],
            }
        }
    }
}
