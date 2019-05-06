import { strict as assert } from 'assert';
import { vec2 } from 'gl-matrix';
import { separateToEdges, buildRects } from '../src';
import { Edge, Rect } from '../src/models';

const toEdge = ([s, t, u, v]: number[]): Edge => ({
    start: vec2.fromValues(s, t),
    end: vec2.fromValues(u, v)
});
const toRect = ([s, t, u, v]: number[]): Rect => ({
    lb: vec2.fromValues(s, t),
    rt: vec2.fromValues(u, v)
});

describe(buildRects.name, () => {
    it('should build 1 rect', () => {
        const vertical = [
            [  0,   0,   0, 100],
            [100,   0, 100, 100],
        ].map(toEdge);
        const horizontal = [
            [  0,   0, 100,   0],
            [  0, 100, 100, 100],
        ].map(toEdge);
        const expect = [
            [  0,   0, 100, 100]
        ].map(toRect);
        const result = [...buildRects(vertical, horizontal)];
        assert.deepStrictEqual(result, expect);
    });

    it ('should build 24 rects', () => {
        /*
        0        300
        ---------- 500
        |  |  |--|
        |  |-----|
        |  |  |--|
        |  |  |--|
        ---------- 0
        */
        const vertical = [
            [300,   0, 300, 500],
            [  0,   0,   0, 500],
            [100,   0, 100, 500],
            [200,   0, 200, 500]
        ].map(toEdge);
        const horizontal = [
            [  0, 500, 300, 500],
            [  0,   0, 300,   0],
            [200, 400, 300, 400],
            [100, 300, 300, 300],
            [200, 200, 300, 200],
            [200, 100, 300, 100]
        ].map(toEdge);
        const result = [...buildRects(...separateToEdges(vertical, horizontal))];
        assert.equal(result.length, 24);
    });
});

describe(separateToEdges.name, () => {
    it('should passthrough uncrossed line fragments', () => {
        const vertical = [
            [  0,   0,   0, 100],
            [100,   0, 100, 100]
        ].map(toEdge);
        const horizontal = [
            // nothing
        ].map(toEdge);
        const [v, h] = separateToEdges(vertical, horizontal);
        assert.deepStrictEqual(v, vertical);
        assert.deepStrictEqual(h, horizontal);
    });

    it('should split crossing line fragments', () => {
        const vertical = [
            [100, 0, 100, 200]
        ].map(toEdge);
        const horizontal = [
            [0, 100, 200, 100]
        ].map(toEdge);
        const verticalExpect = [
            [100,   0, 100, 200],
            [100,   0, 100, 100],
            [100, 100, 100, 200]
        ].map(toEdge);
        const horizontalExpect = [
            [  0, 100, 200, 100],
            [  0, 100, 100, 100],
            [100, 100, 200, 100]
        ].map(toEdge);
        const [v, h] = separateToEdges(vertical, horizontal);
        assert.deepStrictEqual(new Set(v), new Set(verticalExpect));
        assert.deepStrictEqual(new Set(h), new Set(horizontalExpect));
    });

    it ('should create 52 fragments', () => {
        /*
        0        300
        ---------- 500
        |  |  |--|
        |  |-----|
        |  |  |--|
        |  |  |--|
        ---------- 0
        */
        const vertical = [
            [300,   0, 300, 500],
            [  0,   0,   0, 500],
            [100,   0, 100, 500],
            [200,   0, 200, 500]
        ].map(toEdge);
        const horizontal = [
            [  0, 500, 300, 500],
            [  0,   0, 300,   0],
            [200, 400, 300, 400],
            [100, 300, 300, 300],
            [200, 200, 300, 200],
            [200, 100, 300, 100]
        ].map(toEdge);
        const [v, h] = separateToEdges(vertical, horizontal);
        assert.equal(v.length, 34);
        assert.equal(h.length, 18)
    });
});
