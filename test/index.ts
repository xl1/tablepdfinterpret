import { strict as assert } from 'assert';
import { vec2 } from 'gl-matrix';
import { separateToEdges } from '../src';
import { Edge } from '../src/models';

const toEdge = ([s, t, u, v]: number[]): Edge => ({
    start: vec2.fromValues(s, t),
    end: vec2.fromValues(u, v)
});

describe(separateToEdges.name, () => {
    it('should passthrough uncrossed line fragments', () => {
        const input = [
            [  0,   0,   0, 100],
            [100,   0, 100, 100]
        ].map(toEdge);
        const result = separateToEdges(input);
        assert.deepStrictEqual(result, input);
    });

    it('should split crossing line fragments', () => {
        const input = [
            [  0,   0, 200, 200],
            [200,   0,   0, 200]
        ].map(toEdge);
        const expect = [
            [  0,   0, 100, 100],
            [100, 100, 200, 200],
            [200,   0, 100, 100],
            [100, 100,   0, 200]
        ].map(toEdge);
        const result = separateToEdges(input);
        assert.deepStrictEqual(new Set(result), new Set(expect));
    });

    it ('should create 24 fragments', () => {
        const input = [
            [  0, 500, 300, 500],
            [300,   0, 300, 500],
            [  0,   0, 300,   0],
            [  0,   0,   0, 500],
            [100,   0, 100, 500],
            [200,   0, 200, 500],
            [200, 400, 300, 400],
            [100, 300, 300, 300],
            [200, 200, 300, 200],
            [200, 100, 300, 100]
        ].map(toEdge);
        const expect = [
            [  0,   0,   0, 500], [  0, 500, 100, 500],
            [200,   0, 300,   0], [300, 400, 300, 500],
            [100, 300, 100, 500], [300,   0, 300, 100],
            [  0,   0, 100,   0], [100,   0, 200,   0],
            [100,   0, 100, 300], [100, 500, 200, 500],
            [200, 500, 300, 500], [200,   0, 200, 100],
            [200, 100, 200, 200], [200, 100, 300, 100],
            [300, 300, 300, 400], [200, 400, 300, 400],
            [200, 400, 200, 500], [200, 200, 300, 200],
            [300, 100, 300, 200], [300, 200, 300, 300],
            [100, 300, 200, 300], [200, 300, 300, 300],
            [200, 200, 200, 300], [200, 300, 200, 400]
        ].map(toEdge);
        const result = separateToEdges(input);
        assert.deepStrictEqual(new Set(result), new Set(expect));
    });
});
