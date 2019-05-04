import { strict as assert } from 'assert';
import { vec2 } from 'gl-matrix';
import { separateToEdges } from '../src';
import { Edge } from '../src/models';

describe(separateToEdges.name, () => {
    it('should passthrough uncrossed line fragments', () => {
        const input: Edge[] = [
            { start: vec2.fromValues(  0,   0), end: vec2.fromValues(  0, 100) },
            { start: vec2.fromValues(100,   0), end: vec2.fromValues(100, 100) },
        ];
        const result = separateToEdges(input);
        assert.deepStrictEqual(result, input);
    });

    it('should split crossing line fragments', () => {
        const input: Edge[] = [
            { start: vec2.fromValues(  0,   0), end: vec2.fromValues(200, 200) },
            { start: vec2.fromValues(200,   0), end: vec2.fromValues(  0, 200) },
        ];
        const expect: Edge[] = [
            { start: vec2.fromValues(  0,   0), end: vec2.fromValues(100, 100) },
            { start: vec2.fromValues(100, 100), end: vec2.fromValues(200, 200) },
            { start: vec2.fromValues(200,   0), end: vec2.fromValues(100, 100) },
            { start: vec2.fromValues(100, 100), end: vec2.fromValues(  0, 200) },
        ];
        const result = separateToEdges(input);
        assert.deepStrictEqual(new Set(result), new Set(expect));
    });
});
