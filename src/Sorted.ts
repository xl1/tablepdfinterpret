export default class Sorted<TValue> {
    keys: number[] = [];
    values: TValue[] = [];

    add(key: number, value: TValue) {
        if (key < this.keys[0]) {
            this.keys.unshift(key);
            this.values.unshift(value);
            return;
        }
        let i = 0;
        for (let w = 0x1000000; w >= 1; w >>>= 1) {
            if (this.keys[i + w] < key) i += w;
        }
        this.keys.splice(i + 1, 0, key);
        this.values.splice(i + 1, 0, value);
    }
}
