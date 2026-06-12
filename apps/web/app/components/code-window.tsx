/**
 * Marketing hero code window. Hand-tokenized snippet so we don't ship a
 * syntax highlighter for a single static block.
 */

function Line({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="whitespace-pre">{children}</div>;
}

const kw = "text-[#7dd3a8]"; // keywords (import/from/const/await)
const fn = "text-[#e5c07b]"; // identifiers like vault
const str = "text-[#b5e8a0]"; // strings
const punc = "text-[#8aa399]"; // punctuation
const cmt = "text-[#5b7a6a]"; // comments
const prop = "text-[#cfe8d8]"; // config props
const val = "text-[#e6f4ec]"; // values

export function CodeWindow(): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface-code shadow-2xl shadow-brand-900/20 ring-1 ring-white/5">
      {/* title bar */}
      <div className="flex items-center justify-between bg-surface-codeHeader px-5 py-3">
        <span className="font-mono text-xs text-[#7f968a]">usage</span>
        <span className="flex gap-2">
          <Dot />
          <Dot />
          <Dot />
        </span>
      </div>

      {/* code */}
      <div className="space-y-1 px-6 py-6 font-mono text-sm leading-7">
        <Line>
          <span className={kw}>import</span>
          <span className={punc}> {"{ "}</span>
          <span className={val}>vault</span>
          <span className={punc}>{" }"} </span>
          <span className={kw}>from</span>{" "}
          <span className={str}>&apos;vaultlier&apos;</span>
          <span className={punc}>;</span>
        </Line>
        <Line>&nbsp;</Line>
        <Line>
          <span className={kw}>const</span>{" "}
          <span className={prop}>config</span>{" "}
          <span className={punc}>=</span> <span className={kw}>await</span>{" "}
          <span className={fn}>vault</span>
          <span className={punc}>({"{"}</span>
        </Line>
        <Line>
          {"  "}
          <span className={prop}>environment</span>
          <span className={punc}>:</span>{" "}
          <span className={str}>&apos;prod&apos;</span>
        </Line>
        <Line>
          <span className={punc}>{"});"}</span>
        </Line>
        <Line>&nbsp;</Line>
        <CodeResult name="DATABASE_URL" type="string" />
        <CodeResult name="STRIPE_SECRET" type="string" />
        <CodeResult name="FEATURE_NEW_FLOW" type="boolean" />
      </div>
    </div>
  );
}

function CodeResult({
  name,
  type,
}: {
  name: string;
  type: string;
}): React.JSX.Element {
  return (
    <Line>
      <span className={prop}>config.</span>
      <span className={val}>{name}</span>
      <span className="text-[#3f5a4c]">{"  ".repeat(2)}</span>
      <span className={cmt}>{` // ${type}`}</span>
    </Line>
  );
}

function Dot(): React.JSX.Element {
  return <span className="h-3 w-3 rounded-full bg-white/15" />;
}
