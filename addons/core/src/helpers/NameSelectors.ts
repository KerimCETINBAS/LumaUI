import type { SpellNameSelector } from "../core/builder";
import { fail } from "../builder/validate";
interface Token { test(value: string): boolean; optional: boolean; repeat: boolean; }
export interface NameMatcher { Test(name: string): boolean; }
const digit = (value: string) => value >= "0" && value <= "9";
const word = (value: string) => digit(value) || value >= "a" && value <= "z" || value >= "A" && value <= "Z" || value === "_";
function escaped(value: string, insensitive: boolean): (value: string) => boolean {
    if (value === "d" || value === "D") return char => digit(char) === (value === "d");
    if (value === "w" || value === "W") return char => word(char) === (value === "w");
    if (value === "s" || value === "S") return char => " \t\r\n\f\v".includes(char) === (value === "s");
    if (!"\\/.^$*+?[](){}|-".includes(value)) fail("unsupported regex escape: \\" + value);
    const literal = insensitive ? value.toLowerCase() : value;
    return char => char === literal;
}
/** Bounded dynamic programming: patterns never execute code or backtrack exponentially. */
export function compileNameSelector(selector: SpellNameSelector): NameMatcher {
    if (issecretvalue(selector)) fail("spell selectors must be public");
    const regex = typeof selector !== "string";
    const pattern = regex ? selector.regex : selector;
    const flags = regex ? selector.flags ?? "" : "i";
    if (issecretvalue(pattern) || typeof pattern !== "string" || pattern.length > 256 || issecretvalue(flags) || flags !== "" && flags !== "i") fail("invalid spell selector or regex flags (only i is supported)");
    const insensitive = flags === "i";
    const tokens: Token[] = [];
    let start = !regex, end = !regex;
    const add = (test: (value: string) => boolean) => tokens.push({ test, optional: false, repeat: false });
    for (let i = 0; i < pattern.length; i++) {
        const raw = pattern[i], char = insensitive ? raw.toLowerCase() : raw;
        if (!regex) {
            if (raw === "*") tokens.push({ test: () => true, optional: true, repeat: true });
            else add(raw === "?" ? () => true : value => value === char);
            continue;
        }
        if (raw === "^") { if (i !== 0) fail("regex ^ is only supported at the start"); start = true; continue; }
        if (raw === "$") { if (i !== pattern.length - 1) fail("regex $ is only supported at the end"); end = true; continue; }
        if ("*+?".includes(raw)) {
            const previous = tokens[tokens.length - 1];
            if (previous === undefined || previous.optional || previous.repeat) fail("invalid or unsupported regex quantifier");
            previous.optional = raw !== "+"; previous.repeat = raw !== "?"; continue;
        }
        if (raw === "\\") {
            if (++i >= pattern.length) fail("unfinished regex escape"); add(escaped(pattern[i], insensitive)); continue;
        }
        if (raw === "[") {
            const choices: ((value: string) => boolean)[] = [];
            let negate = false;
            if (pattern[i + 1] === "^") { negate = true; i++; }
            let closed = false;
            while (++i < pattern.length) {
                if (pattern[i] === "]") { closed = true; break; }
                let low = insensitive ? pattern[i].toLowerCase() : pattern[i];
                if (pattern[i] === "\\") {
                    if (++i >= pattern.length) fail("unfinished character class escape"); choices.push(escaped(pattern[i], insensitive));
                } else if (pattern[i + 1] === "-" && pattern[i + 2] !== "]" && pattern[i + 2] !== undefined) {
                    i += 2; const high = insensitive ? pattern[i].toLowerCase() : pattern[i];
                    if (low > high || pattern[i] === "\\") fail("invalid or unsupported character range");
                    choices.push(value => value >= low && value <= high);
                } else choices.push(value => value === low);
            }
            if (!closed || choices.length === 0) fail("invalid regex character class");
            add(value => choices.some(test => test(value)) !== negate); continue;
        }
        if ("(){}|]".includes(raw)) fail("regex groups, alternatives and counted repetitions are not supported yet");
        add(raw === "." ? () => true : value => value === char);
    }
    return { Test: (name: string) => {
        if (issecretvalue(name) || name.length > 512) return false;
        const value = insensitive ? name.toLowerCase() : name;
        let previous = Array.from({ length: value.length + 1 }, (_, index) => !start || index === 0);
        for (const token of tokens) {
            const next: boolean[] = [token.optional && previous[0]];
            for (let i = 1; i <= value.length; i++) next[i] = token.optional && previous[i]
                || token.test(value[i - 1]) && (previous[i - 1] || token.repeat && next[i - 1]);
            previous = next;
        }
        return end ? previous[value.length] : previous.some(value => value);
    } };
}
/** The helper argument grammar is data only: quoted names/globs or /regex/i. */
export function parseSpellSelectors(input: string): SpellNameSelector[] {
    if (issecretvalue(input) || typeof input !== "string" || input.length > 4096) fail("invalid spell filter expression");
    const selectors: SpellNameSelector[] = [];
    let i = 0;
    const whitespace = () => { while (i < input.length && " \t\r\n".includes(input[i])) i++; };
    whitespace();
    while (i < input.length) {
        if (selectors.length >= 32) fail("too many spell filters");
        const quote = input[i];
        let value = "";
        if (quote === '"' || quote === "'") {
            i++; let closed = false;
            while (i < input.length) {
                const char = input[i++];
                if (char === quote) { closed = true; break; }
                if (char === "\\") {
                    if (i >= input.length || !"\\\"'".includes(input[i])) fail("unsupported quoted-string escape");
                    value += input[i++];
                } else value += char;
            }
            if (!closed) fail("unfinished quoted spell filter");
            selectors.push(value);
        } else if (quote === "/") {
            i++; let closed = false;
            while (i < input.length) {
                const char = input[i++];
                if (char === "/") { closed = true; break; }
                if (char === "\\") { if (i >= input.length) fail("unfinished regex escape"); value += char + input[i++]; }
                else value += char;
            }
            if (!closed) fail("unfinished regex selector");
            let flags = ""; while (i < input.length && !", \t\r\n".includes(input[i])) flags += input[i++];
            selectors.push({ regex: value, flags: flags as "" | "i" });
        } else {
            while (i < input.length && input[i] !== ",") value += input[i++];
            value = value.trim();
            if (value === "" || [...value].some(char => !"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_*? -".includes(char))) fail("quote spell names or use a /regex/i selector");
            selectors.push(value);
        }
        whitespace();
        if (i < input.length) {
            if (input[i++] !== ",") fail("separate spell filters with commas");
            whitespace(); if (i === input.length) fail("missing spell filter after comma");
        }
    }
    for (const selector of selectors) compileNameSelector(selector);
    return selectors;
}
