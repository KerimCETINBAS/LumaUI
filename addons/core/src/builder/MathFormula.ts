type Expression = { kind: "number"; value: number } | { kind: "input" }
    | { kind: "unary"; sign: number; child: Expression }
    | { kind: "binary"; operator: string; left: Expression; right: Expression };

/** Small bounded arithmetic grammar. Expressions cannot call functions or execute Lua. */
export class MathFormula {
    private offset = 0;
    private token = "";
    private tokens = 0;
    private readonly tree: Expression;
    public constructor(private readonly text: string) {
        if (issecretvalue(text) || typeof text !== "string" || text.length === 0 || text.length > 256) error("MathConverter: expression must contain 1–256 characters");
        this.Next(); this.tree = this.Add(0);
        if (this.token !== "") error("MathConverter: unexpected token " + this.token);
    }
    private Next(): void {
        if (++this.tokens > 128) error("MathConverter: expression is too complex");
        while (" \t\r\n".includes(this.text[this.offset] ?? "\0")) this.offset++;
        const char = this.text[this.offset];
        if (char === undefined) { this.token = ""; return; }
        if (this.text.slice(this.offset, this.offset + 5) === "input") { this.offset += 5; this.token = "input"; return; }
        if ("0123456789.".includes(char)) {
            const start = this.offset++;
            while ("0123456789.".includes(this.text[this.offset] ?? "\0")) this.offset++;
            if (this.text[this.offset] === "e" || this.text[this.offset] === "E") {
                this.offset++;
                if (this.text[this.offset] === "+" || this.text[this.offset] === "-") this.offset++;
                while ("0123456789".includes(this.text[this.offset] ?? "\0")) this.offset++;
            }
            this.token = this.text.slice(start, this.offset);
            if (!Number.isFinite(Number(this.token))) error("MathConverter: invalid number");
            return;
        }
        if ("+-*/%^()".includes(char)) {
            this.offset++; this.token = char;
            if (char === "*" && this.text[this.offset] === "*") { this.offset++; this.token = "^"; }
            return;
        }
        error("MathConverter: only input, numbers and arithmetic operators are allowed");
    }
    private Depth(depth: number): void { if (depth > 32) error("MathConverter: expression nesting is too deep"); }
    private Add(depth: number): Expression {
        let left = this.Multiply(depth);
        while (this.token === "+" || this.token === "-") {
            const operator = this.token; this.Next(); left = { kind: "binary", operator, left, right: this.Multiply(depth) };
        }
        return left;
    }
    private Multiply(depth: number): Expression {
        let left = this.Unary(depth);
        while (["*", "/", "%"].includes(this.token)) {
            const operator = this.token; this.Next(); left = { kind: "binary", operator, left, right: this.Unary(depth) };
        }
        return left;
    }
    private Unary(depth: number): Expression {
        this.Depth(depth);
        if (this.token === "+" || this.token === "-") {
            const sign = this.token === "-" ? -1 : 1; this.Next(); return { kind: "unary", sign, child: this.Unary(depth + 1) };
        }
        let left = this.Primary(depth);
        if (this.token === "^") { this.Next(); left = { kind: "binary", operator: "^", left, right: this.Unary(depth + 1) }; }
        return left;
    }
    private Primary(depth: number): Expression {
        this.Depth(depth);
        if (this.token === "input") { this.Next(); return { kind: "input" }; }
        if (this.token === "(") {
            this.Next(); const value = this.Add(depth + 1);
            if (this.token as string !== ")") error("MathConverter: missing closing parenthesis");
            this.Next(); return value;
        }
        if (this.token !== "" && Number.isFinite(Number(this.token))) { const value = Number(this.token); this.Next(); return { kind: "number", value }; }
        error("MathConverter: expected input, a number or parentheses");
    }
    public Evaluate(input: number): number {
        if (issecretvalue(input) || typeof input !== "number" || !Number.isFinite(input)) error("MathConverter: input must be a readable finite number");
        const read = (node: Expression): number => {
            if (node.kind === "input") return input;
            if (node.kind === "number") return node.value;
            if (node.kind === "unary") return node.sign * read(node.child);
            const left = read(node.left), right = read(node.right);
            if ((node.operator === "/" || node.operator === "%") && right === 0) error("MathConverter: division by zero");
            const result = node.operator === "+" ? left + right : node.operator === "-" ? left - right : node.operator === "*" ? left * right
                : node.operator === "/" ? left / right : node.operator === "%" ? left % right : left ** right;
            if (!Number.isFinite(result)) error("MathConverter: result must be finite");
            return result;
        };
        return read(this.tree);
    }
}
