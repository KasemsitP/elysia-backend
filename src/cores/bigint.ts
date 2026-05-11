(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

export type Serialized<T> = {
    [K in keyof T]: T[K] extends bigint
        ? string
        : T[K] extends bigint | null
        ? string | null
        : T[K];
};

export function serializeBigInt<T extends Record<string, any>>(obj: T): Serialized<T> {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = typeof value === "bigint" ? value.toString() : value;
    }
    return result;
}