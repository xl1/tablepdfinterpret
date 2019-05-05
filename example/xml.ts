type ElementFactory<T extends Element> =
    (attrs?: { [key: string]: any }, children?: (Node|string)[]) => T;

export default function<TMap extends { [K in keyof TMap]: Element }> (createElement: <K extends keyof TMap>(key: K) => TMap[K]) {
    type TargetType = { [K in keyof TMap]: ElementFactory<TMap[K]> };
    const obj: Partial<TargetType> = {};
    return new Proxy(obj, {
        get<K extends keyof TMap>(target: TargetType, key: K): ElementFactory<TMap[K]> {
            return (attrs = {}, children = []) => {
                const node = createElement(key);
                for (const attr in attrs) {
                    node.setAttribute(attr, attrs[attr]);
                }
                node.append(...children);
                return node;
            };
        }
    });
};
