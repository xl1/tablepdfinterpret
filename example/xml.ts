type ElementFactory<T extends Element> =
    (attrs?: { [key: string]: any }, children?: (Node|string)[]) => T;

export default function <T extends Element>(createElement: (key: string) => T) {
    const obj: { [key: string]: ElementFactory<T> } = {};
    return new Proxy(obj, {
        get(target, key: string): ElementFactory<T> {
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
