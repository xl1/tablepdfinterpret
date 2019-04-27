import { vec2 } from "gl-matrix";

export interface Edge {
    start: vec2;
    end: vec2;
}

export interface Rect {
    lb: vec2;
    rt: vec2;
}

export interface TextRect extends Rect {
    strings: string[];
}
