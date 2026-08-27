/**
 * author thebadlorax
 * created on 26-08-2026-14h-34m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

function pack(type, id, x, y) {
    return (
        (BigInt(type) << 56n) |
        (BigInt(id)   << 48n) |
        (BigInt(x)    << 24n) |
        BigInt(y)
    );
}

const packet = pack(3, 5, 123456, 123456)

console.log(packet.toString(2))