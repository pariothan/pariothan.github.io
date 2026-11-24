/* Treditor — built-in theories (all fully editable in the Theory tab) and lessons. */
'use strict';
const Theories = (() => {
  const display = (o = {}) => ({
    showTypes: true, showDen: true, showVals: true, arrows: true, checkGrammar: true,
    edge: 'straight', alignLeaves: false, uncurry: true, lambda: 'λ', typeStyle: 'angle', compact: false, ...o,
  });

  const HK = {
    id: 'hk', name: 'Heim & Kratzer — extensional semantics',
    description: 'Typed λ-calculus over phrase-structure trees. Function Application, Predicate Modification, Predicate Abstraction; traces as variables; evaluation in a model.',
    categories: 'S\nDP\nNP\nVP\nV\nD\nN\nA\nAP\nPP\nP',
    baseTypes: 'e t s v n',
    varTypes: 'x, y, z : e\nP, Q, R : <e,t>\np, q : t\nw : s',
    grammar: [
      'S -> DP VP',
      'DP -> D NP',
      'NP -> N | AP NP | NP PP',
      'VP -> V | V DP | V AP | V PP',
      'AP -> A',
      'PP -> P DP',
    ].join('\n'),
    lexicon: [
      '# word : Category : type : λ-term   (term defaults to a constant named after the word)',
      'John, Mary, Ann, Felix, Fido : DP : e',
      'smokes, sleeps, purrs, barks : V : <e,t>',
      'loves : V : <e,<e,t>> : λx.λy.loves(y, x)',
      'likes : V : <e,<e,t>> : λx.λy.likes(y, x)',
      'saw : V : <e,<e,t>> : λx.λy.saw(y, x)',
      'cat, dog, man, woman : N : <e,t>',
      'gray, happy : A : <e,t>',
      'the : D : <<e,t>,e> : λP.ιx.P(x)',
      'every : D : <<e,t>,<<e,t>,t>> : λP.λQ.∀x.P(x) → Q(x)',
      'some, a : D : <<e,t>,<<e,t>,t>> : λP.λQ.∃x.P(x) ∧ Q(x)',
      'no : D : <<e,t>,<<e,t>,t>> : λP.λQ.¬∃x.P(x) ∧ Q(x)',
      'is : V : vacuous',
      'with : P : <e,<e,t>> : λx.λy.with(y, x)',
    ].join('\n'),
    composition: [
      '# Name {options}: daughter types => result template   (#0, #1 = daughters in pattern order)',
      'FA: <a,b>, a => #0(#1)',
      'PM: <e,t>, <e,t> => λx.#0(x) ∧ #1(x)',
      'PA {fixed}: idx, t => λx$i.#1',
      'NN: a => #0',
    ].join('\n'),
    traceRegex: '^(?:t|he|she|it|him|her|pro|PRO)_?(\\d+)$',
    traceTerm: 'x$1',
    indexRegex: '^(\\d+)$',
    labelStrip: '_[^_]*$',
    leafFallback: 'none',
    rewrite: [
      '# Name: [pattern] => [result]     ?x subtree, ?x* sequence, $X any label, <?x> silent copy',
      'Topicalize object: [S ?subj [VP ?v ?obj]] => [S ?obj [S ?subj [VP ?v ?obj]]]',
    ].join('\n'),
    model: [
      'D = {john, mary, ann, felix, fido}',
      'smokes = {john}',
      'sleeps = {felix, mary}',
      'purrs = {felix}',
      'barks = {fido}',
      'loves = {(john, mary), (mary, john), (ann, felix), (john, felix)}',
      'likes = {(ann, fido), (mary, felix)}',
      'saw = {(mary, fido), (john, fido)}',
      'with = {(john, fido)}',
      'cat = {felix}',
      'dog = {fido}',
      'man = {john}',
      'woman = {mary, ann}',
      'gray = {felix, fido}',
      'happy = {john, mary}',
    ].join('\n'),
    movement: 'trace', traceLabel: 't', qrBinder: true, mergeLabel: 'first', moveIndex: 'number',
    display: display(),
    examples: [
      { name: 'John smokes', tree: '[S [DP John] [VP [V smokes]]]' },
      { name: 'Mary loves John', tree: '[S [DP Mary] [VP [V loves] [DP John]]]' },
      { name: 'The gray cat purrs', tree: '[S [DP [D the] [NP [AP [A gray]] [NP [N cat]]]] [VP [V purrs]]]' },
      { name: 'Felix is gray (vacuous “is”)', tree: '[S [DP Felix] [VP [V is] [AP [A gray]]]]' },
      { name: 'Every cat sleeps', tree: '[S [DP [D every] [NP [N cat]]] [VP [V sleeps]]]' },
      { name: 'Mary loves every cat — type clash', tree: '[S [DP Mary] [VP [V loves] [DP [D every] [NP [N cat]]]]]' },
      { name: '… fixed by QR + Predicate Abstraction', tree: '[S [DP_1 [D every] [NP [N cat]]] ["" 1 [S [DP Mary] [VP [V loves] t_1]]]]' },
      { name: 'The woman sleeps — presupposition failure', tree: '[S [DP [D the] [NP [N woman]]] [VP [V sleeps]]]' },
    ],
  };

  const XBAR = {
    id: 'xbar', name: 'X-bar Theory (GB)',
    description: 'Endocentric X-bar schemata with specifiers, complements and adjuncts. Movement leaves coindexed traces.',
    categories: 'CP\nC\'\nC\nTP\nT\'\nT\nVP\nV\'\nV\nDP\nD\'\nD\nNP\nN\'\nN\nAP\nA\'\nA\nPP\nP\'\nP\nAdvP\nAdv\'\nAdv',
    baseTypes: 'e t', varTypes: '', composition: '', model: '',
    grammar: [
      'CP -> (DP) C\'',
      'C\' -> C TP',
      'TP -> DP T\' | CP T\'',
      'T\' -> T VP',
      'VP -> V\'',
      'V\' -> V | V DP | V CP | V DP PP | V\' PP | AdvP V\'',
      'DP -> D\'',
      'D\' -> D NP | D',
      'NP -> N\'',
      'N\' -> N | N PP | AP N\' | N\' PP',
      'AP -> A\'',
      'A\' -> A | AdvP A\'',
      'PP -> P\'',
      'P\' -> P DP',
      'AdvP -> Adv\'',
      'Adv\' -> Adv',
    ].join('\n'),
    lexicon: [
      'the, a, this, which : D',
      'John, Mary : D',
      'what, who : D',
      'student, book, linguist, garden, theory : N',
      'read, see, think, said, put : V',
      'old, interesting, new : A',
      'in, on, with, about : P',
      'quickly, often : Adv',
      'will, can, should, did : T',
      'that, if, ∅ : C',
    ].join('\n'),
    traceRegex: '^t_?(\\d+)$', traceTerm: 'x$1', indexRegex: '', labelStrip: '_[^_]*$', leafFallback: 'none',
    rewrite: [
      'T-to-C: [CP [C\' [C ?c] [TP ?subj [T\' [T ?t] ?vp]]]] => [CP [C\' [C ?t] [TP ?subj [T\' [T t] ?vp]]]]',
    ].join('\n'),
    movement: 'trace', traceLabel: 't', qrBinder: false, mergeLabel: 'first',
    display: display({ showTypes: false, showDen: false, showVals: false, alignLeaves: true }),
    examples: [
      { name: 'The student will read an old book', tree: '[CP [C\' [C ∅] [TP [DP [D\' [D the] [NP [N\' [N student]]]]] [T\' [T will] [VP [V\' [V read] [DP [D\' [D a] [NP [N\' [AP [A\' [A old]]] [N\' [N book]]]]]]]]]]]]' },
      { name: 'What will John read? (move DP & T to C)', tree: '[CP [C\' [C ∅] [TP [DP [D\' [D John]]] [T\' [T will] [VP [V\' [V read] [DP [D\' [D what]]]]]]]]]' },
      { name: 'Roofed phrases', tree: '[TP [DP^ the old linguist] [T\' [T should] [VP [V\' [V said] [CP^ that theories are interesting]]]]]' },
    ],
  };

  const MP = {
    id: 'mp', name: 'Minimalist Program — Merge & Move',
    description: 'Bare phrase structure built bottom-up with Merge. Internal Merge (movement) leaves unpronounced copies. Labels project from the first selected item.',
    categories: 'C\nT\nv\nV\nD\nn\nN\nP\nA',
    baseTypes: 'e t', varTypes: '', composition: '', model: '', grammar: '',
    lexicon: [
      'the, a, which : D',
      'cat, mouse, linguist, book : N',
      'chased, saw, read : V',
      'PAST, PRES, will : T',
      '∅, that : C',
      '∅v : v',
    ].join('\n'),
    traceRegex: '', traceTerm: 'x$1', indexRegex: '', labelStrip: '_[^_]*$', leafFallback: 'none',
    rewrite: '',
    movement: 'copy', traceLabel: 't', qrBinder: false, mergeLabel: 'first',
    display: display({ showTypes: false, showDen: false, showVals: false }),
    examples: [
      { name: 'Numeration (build it with Merge)', tree: '[C ∅] [T{uφ EPP} PAST] [v{uD} ∅] [D the] [N cat] [V{uD} chased] [D a] [N mouse]' },
      { name: 'Finished vP', tree: '[v [D [D the] [N cat]] [v [v{uD} ∅] [V [V{uD} chased] [D [D a] [N mouse]]]]]' },
    ],
  };

  const TG = {
    id: 'tg', name: 'Transformational Grammar (1957-style)',
    description: 'Phrase-structure rules generate kernel sentences; structure-dependent transformations map them to derived structures.',
    categories: 'S\nNP\nVP\nAux\nV\nDet\nN\nName\nPP\nP\nNeg',
    baseTypes: 'e t', varTypes: '', composition: '', model: '',
    grammar: ['S -> NP VP | Aux NP VP', 'NP -> Det N | Name', 'VP -> Aux V NP | Aux V | Aux V PP | Aux Aux V PP | Aux Neg V NP', 'PP -> P NP'].join('\n'),
    lexicon: ['John, Mary : Name', 'the, a : Det', 'dog, cat, man, letter : N', 'will, can, has : Aux', 'be, been : Aux', 'see, chase, write, eat : V', 'by : P', 'not : Neg'].join('\n'),
    traceRegex: '', traceTerm: 'x$1', indexRegex: '', labelStrip: '_[^_]*$', leafFallback: 'none',
    rewrite: [
      'Passive: [S ?np1 [VP [Aux ?aux] [V ?v] ?np2]] => [S ?np2 [VP [Aux ?aux] [Aux be] [V ?v] [PP [P by] ?np1]]]',
      'Negation: [S ?np [VP [Aux ?aux] ?rest*]] => [S ?np [VP [Aux ?aux] [Neg not] ?rest*]]',
      'Subject-Aux Inversion: [S ?np [VP [Aux ?aux] ?rest*]] => [S [Aux ?aux] ?np [VP ?rest*]]',
    ].join('\n'),
    movement: 'none', traceLabel: 't', qrBinder: false, mergeLabel: 'first',
    display: display({ showTypes: false, showDen: false, showVals: false }),
    examples: [
      { name: 'The man will write a letter', tree: '[S [NP [Det the] [N man]] [VP [Aux will] [V write] [NP [Det a] [N letter]]]]' },
      { name: 'John can see Mary', tree: '[S [NP [Name John]] [VP [Aux can] [V see] [NP [Name Mary]]]]' },
    ],
  };

  const PL = {
    id: 'pl', name: 'Propositional Logic — formula trees',
    description: 'Formulas as trees: compositional truth values, and rewrite rules for normal forms (try “Normalize” on the Transform tab).',
    categories: '¬\n∧\n∨\n→\n↔\np\nq\nr\ns',
    baseTypes: 't', varTypes: 'p, q, r, s : t', grammar: '', lexicon: '',
    composition: [
      'Not {label=^¬$}: t => ¬#0',
      'And {label=^∧$; fixed}: t, t => #0 ∧ #1',
      'Or {label=^∨$; fixed}: t, t => #0 ∨ #1',
      'If {label=^→$; fixed}: t, t => #0 → #1',
      'Iff {label=^↔$; fixed}: t, t => #0 ↔ #1',
    ].join('\n'),
    traceRegex: '', traceTerm: 'x$1', indexRegex: '', labelStrip: '', leafFallback: 'constant',
    rewrite: [
      'Biconditional: [↔ ?a ?b] => [∧ [→ ?a ?b] [→ ?b ?a]]',
      'Implication: [→ ?a ?b] => [∨ [¬ ?a] ?b]',
      'Double negation: [¬ [¬ ?a]] => ?a',
      'De Morgan ∧: [¬ [∧ ?a ?b]] => [∨ [¬ ?a] [¬ ?b]]',
      'De Morgan ∨: [¬ [∨ ?a ?b]] => [∧ [¬ ?a] [¬ ?b]]',
      'Commute ∧ {manual}: [∧ ?a ?b] => [∧ ?b ?a]',
      'Commute ∨ {manual}: [∨ ?a ?b] => [∨ ?b ?a]',
      'Distribute ∨ over ∧ {manual}: [∨ ?a [∧ ?b ?c]] => [∧ [∨ ?a ?b] [∨ ?a ?c]]',
    ].join('\n'),
    model: 'p = true\nq = false\nr = true\ns = false',
    movement: 'none', traceLabel: 't', qrBinder: false, mergeLabel: 'blank',
    display: display({ showTypes: false, uncurry: true }),
    examples: [
      { name: '¬(p ∧ (q → ¬¬r))', tree: '[¬ [∧ p [→ q [¬ [¬ r]]]]]' },
      { name: '(p ↔ q) ∨ ¬s', tree: '[∨ [↔ p q] [¬ s]]' },
    ],
  };

  const ARITH = {
    id: 'arith', name: 'Arithmetic expressions',
    description: 'Shows the engine is theory-neutral: numbers as leaves, operators as nodes, algebraic rewrite rules.',
    categories: '+\n−\n×\n÷',
    baseTypes: 'n t', varTypes: '', grammar: '', lexicon: '',
    composition: [
      'Add {label=^\\+$; fixed}: n, n => #0 + #1',
      'Sub {label=^[−-]$; fixed}: n, n => #0 - #1',
      'Mul {label=^[×*]$; fixed}: n, n => #0 * #1',
      'Div {label=^[÷/]$; fixed}: n, n => #0 / #1',
    ].join('\n'),
    traceRegex: '', traceTerm: 'x$1', indexRegex: '', labelStrip: '', leafFallback: 'term',
    rewrite: [
      'Distribute: [× ?a [+ ?b ?c]] => [+ [× ?a ?b] [× ?a ?c]]',
      'Commute + {manual}: [+ ?a ?b] => [+ ?b ?a]',
      'Commute × {manual}: [× ?a ?b] => [× ?b ?a]',
    ].join('\n'),
    model: '',
    movement: 'none', traceLabel: 't', qrBinder: false, mergeLabel: 'blank',
    display: display({ showTypes: false }),
    examples: [{ name: '2 × (3 + 4)', tree: '[× 2 [+ 3 4]]' }, { name: '(2 + 3) × (7 − 4)', tree: '[× [+ 2 3] [− 7 4]]' }],
  };

  const BLANK = {
    id: 'blank', name: 'Blank theory',
    description: 'Start from scratch: define your own categories, rules, types and transformations.',
    categories: '', baseTypes: 'e t', varTypes: 'x, y, z : e', grammar: '', lexicon: '', composition: 'FA: <a,b>, a => #0(#1)\nNN: a => #0',
    traceRegex: '^t_?(\\d+)$', traceTerm: 'x$1', indexRegex: '^(\\d+)$', labelStrip: '_[^_]*$', leafFallback: 'none',
    rewrite: '', model: '', movement: 'trace', traceLabel: 't', qrBinder: false, mergeLabel: 'first',
    display: display(), examples: [{ name: 'Empty', tree: '' }],
  };


  const SYN = {
    id: 'syn', name: 'Syntax trees (theory-neutral)',
    description: 'Draw any constituency tree — labels are free text. Turn on semantics, grammar checking or transformations from the Features menu when you need them.',
    categories: ['S', 'CP', "C'", 'C', 'TP', "T'", 'T', 'vP', "v'", 'v', 'VP', "V'", 'V', 'DP', "D'", 'D', 'NP', "N'", 'N', 'AP', "A'", 'A', 'PP', "P'", 'P', 'AdvP', 'Adv', 'ConjP', 'Conj', 'NegP', 'Neg', '∅', 'PRO', 't'].join('\n'),
    baseTypes: 'e t', varTypes: 'x, y, z : e', grammar: '', lexicon: '', composition: '',
    traceRegex: '^(?:t|he|she|it|pro|PRO)_?(\\d+)$', traceTerm: 'x$1', indexRegex: '^(\\d+)$', labelStrip: '_[^_]*$', leafFallback: 'none',
    rewrite: '', model: '', movement: 'none', traceLabel: 't', qrBinder: false, mergeLabel: 'first',
    display: display({ showTypes: false, showDen: false, showVals: false, checkGrammar: false }),
    examples: [
      { name: 'Simple sentence', tree: '[S [NP [D the] [N linguist]] [VP [V drew] [NP [D a] [N tree]]]]' },
      { name: 'Wh-question with traces', tree: "[CP [DP_i what] [C' [C will_j] [TP [DP she] [T' [T t_j] [VP [V' [V draw] [DP t_i]]]]]]]" },
      { name: 'Unpronounced copies', tree: "[CP [DP_i who] [C' [C did] [TP [DP you] [T' [T <did>] [VP [V see] <DP_i>]]]]]" },
    ],
  };

  HK.features = { sem: true }; XBAR.features = { gram: true }; MP.features = {}; TG.features = { gram: true, tx: true, deriv: true };
  PL.features = { sem: true, tx: true, deriv: true }; ARITH.features = { sem: true, tx: true }; BLANK.features = {}; SYN.features = {};


  const HPSG = {
    id: 'hpsg', name: 'HPSG — toolkit (start here)', features: { avm: true }, hpsg: true,
    description: 'Typed feature structures with your own type hierarchy, constraints, lexicon, lexical rules and grammar rules. Write them on the Theory tab; build trees in the HPSG tab.',
    categories: 'S\nNP\nVP\nV\nN\nD\nP\nPP\nA\nAP',
    signature: "; \u2500\u2500 Treditor HPSG toolkit \u2014 write your grammar here \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n; TYPES\n;   type := supertype & supertype & [ FEATURE value, \u2026 ].    multiple inheritance; constraints are inherited\n;   atom.      sort := supertype.                             atomic sorts\n; VALUES\n;   atom   [type FEAT v, FEAT|PATH v]   <a, b>   <a, ...> (open)   <a, (b)> (optional)   {a, b}\n;   #1 (tag / structure sharing)   a \u2295 b (append)   v / d (default d)   type & [ \u2026 ]   list(type)\n; DIRECTIVES\n;   @alias HEAD SYN|HEAD          shorthand; also tells the built-in schemata where HEAD, SPR, COMPS, MOD,\n;                                 GAP, RESTR, INDEX, MODE, PHON and ARG-ST live (defaults: SYN|HEAD, SYN|VAL|SPR, \u2026)\n;   @abbr NP [HEAD noun, SPR < >, COMPS < >]   node labels & abbreviations usable in AVMs (NP_i binds @abbrindex)\n;   @abbrindex SEM|INDEX\n; GRAMMAR RULES\n;   any subtype of `rule` with ARGS <daughter, \u2026> is tried when building; the rule type is the mother.\n;   The built-in schemata and principles can be switched on/off in the HPSG tab.\n; BUILT-IN TYPES:  *top*  list  elist  nelist [FIRST, REST]  set  rule [ARGS list]\n",
    hpsgLex: "; name := lexical-type & [ \u2026 ].     e.g.\n; kim := pn-lxm & [PHON <\"Kim\">, SEM|INDEX #i, SEM|RESTR <[RELN name, NAME Kim, NAMED #i]>].\n; Optional arguments: ARG-ST <NP, (PP)>.   Irregular morphology:  @irreg see past saw\n",
    hpsgRules: "# Name (i|d|p, morphology): [input] => [output]\n#   i = inflectional (lexeme \u2192 word; output adds to the input)\n#   d = derivational, p = post-inflectional (output keeps whatever it doesn't override \u2014 default identity)\n#   morphology: 3sg pl past psp prp er base =  or +suffix / prefix+  (irregulars from @irreg)\n# e.g.  3sg verb (i, 3sg): [verb-lxm] => [word HEAD [FORM fin, AGR 3sing]]\n",
    baseTypes: 'e t', varTypes: '', grammar: '', lexicon: '', composition: '', rewrite: '', model: '',
    traceRegex: '', traceTerm: 'x$1', indexRegex: '', labelStrip: '_[^_]*$', leafFallback: 'none',
    movement: 'none', traceLabel: 't', qrBinder: false, mergeLabel: 'first', hpsgLabels: true, hpsgHeads: true,
    labelAvms: "# Label: default feature structure (invoked from the node, right-click, Ctrl+K, or HPSG tab → Defaults)\nS: [phrase SYN [HEAD verb, VAL [SPR < >, COMPS < >]]]\nVP: [phrase SYN [HEAD verb, VAL [SPR <NP>, COMPS < >]]]\nV: [word SYN [HEAD verb]]\nNP: [phrase SYN [HEAD noun, VAL [SPR < >, COMPS < >]]]\nNOM: [phrase SYN [HEAD noun, VAL [SPR <DP>, COMPS < >]]]\nN: [word SYN [HEAD noun]]\nDP: [phrase SYN [HEAD det, VAL [SPR < >, COMPS < >]]]\nD: [word SYN [HEAD det]]\nPP: [phrase SYN [HEAD prep, VAL [SPR < >, COMPS < >]]]\nP: [word SYN [HEAD prep]]\nAP: [phrase SYN [HEAD adj, VAL [COMPS < >]]]\nA: [word SYN [HEAD adj]]\nCP: [phrase SYN [HEAD comp, VAL [SPR < >, COMPS < >]]]\nC: [word SYN [HEAD comp]]", avmHide: 'PHON, GAP, MOD', avmFold: '',
    display: display({ showTypes: false, showDen: false, showVals: false, checkGrammar: false, italicWords: false, avmView: 'compact' }),
    examples: [
      { name: 'John cries — semantics (written by hand)', doc: { arrows: [], roots: [
        { id: 'h1', label: '', avm: '[SIT s_1, RESTR <[RELN *name*, NAME John, NAMED x], [RELN *cry*, SIT s_1, CRYER x]>]', ch: [
          { id: 'h2', label: '', avm: '#1 [INDEX x, RESTR <[RELN *name*, NAME John, NAMED x]>]', ch: [{ id: 'h3', label: 'John', ch: [] }] },
          { id: 'h4', label: '', avm: '[ARG-ST <#1_x>, SEM [SIT s_1, RESTR <[RELN *cry*, SIT s_1, CRYER x]>]]', ch: [{ id: 'h5', label: 'cries', ch: [] }] },
        ] }] } },
    ],
  };
  const HPSG_EX = {
    ...HPSG, id: 'hpsg-ex', name: 'HPSG — example grammar (to try the tools)',
    description: 'A small textbook-style grammar (types, lexicon with optional arguments and defaults, inflectional and derivational rules) to try the toolkit on. Not a substitute for your own.',
    signature: "; HPSG after Sag, Wasow & Bender (2003), Syntactic Theory \u2014 edit freely.\n; type := supertype & supertype & [ constraint ].   values: atoms, [AVMs], <lists>, #tags, a \u2295 b, / default, (optional)\n@alias HEAD SYN|HEAD\n@alias VAL SYN|VAL\n@alias SPR SYN|VAL|SPR\n@alias COMPS SYN|VAL|COMPS\n@alias MOD SYN|VAL|MOD\n@alias GAP SYN|GAP\n@alias FORM SYN|HEAD|FORM\n@alias AGR SYN|HEAD|AGR\n@alias CASE SYN|HEAD|CASE\n@alias MODE SEM|MODE\n@alias INDEX SEM|INDEX\n@alias RESTR SEM|RESTR\n@abbrindex SEM|INDEX\n\n; --- category abbreviations (first match labels a node; words first)\n@abbr V [word HEAD verb]\n@abbr D [word HEAD det]\n@abbr P [word HEAD prep]\n@abbr A [word HEAD adj]\n@abbr Conj [word HEAD conj]\n@abbr NP [HEAD noun, SPR < >, COMPS < >]\n@abbr N [word HEAD noun]\n@abbr S [HEAD verb, SPR < >, COMPS < >]\n@abbr VP [HEAD verb, SPR <[ ]>, COMPS < >]\n@abbr NOM [HEAD noun, SPR <[ ]>, COMPS < >]\n@abbr PP [HEAD prep, SPR < >, COMPS < >]\n@abbr DP [HEAD det, SPR < >, COMPS < >]\n@abbr AP [HEAD adj, COMPS < >]\n\n; --- atomic sorts\nbool.  + := bool.  - := bool.\nmode.  prop := mode.  ques := mode.  dir := mode.  ref := mode.  none := mode.\nindex.  ref-index := index.  sit-index := index.\nper.  1st := per.  2nd := per.  3rd := per.\nnum.  sg := num.  pl := num.\ncase.  nom := case.  acc := case.\nform.  fin := form.  base := form.  prp := form.  psp := form.  pass := form.  inf := form.  nform := form.\nreln.\n\n; --- agreement\nagr-cat := [PER per, NUM num].\n3sing := agr-cat & [PER 3rd, NUM sg].\nnon-3sing := agr-cat.\n1sing := non-3sing & [PER 1st, NUM sg].\n\n; --- parts of speech\npos := [FORM form].\nagr-pos := pos & [AGR agr-cat].\nverb := agr-pos & [AUX bool / -].\nnoun := agr-pos & [CASE case].\ndet := agr-pos & [COUNT bool].\nprep := pos.  adj := pos.  adv := pos.  conj := pos.\n\n; --- signs\npredication := [RELN reln].\nval-cat := [SPR list(expression), COMPS list(expression), MOD list(expression) / < >].\nsyn-cat := [HEAD pos, VAL val-cat, GAP list(expression) / < >].\nsem-cat := [MODE mode, INDEX index, RESTR list(predication)].\nexpression := [PHON list, SYN syn-cat, SEM sem-cat].\nword := expression & [ARG-ST #a \u2295 #b, SPR #a, COMPS #b].     ; Argument Realization Principle\nphrase := expression.\nlexeme := expression & [ARG-ST list(expression)].\n\n; --- phrase types (add your own constraints here; principles are switched in the HPSG tab)\nheaded-ph := phrase.\nhd-comp-ph := headed-ph.  hd-spr-ph := headed-ph.  hd-mod-ph := headed-ph.\nhd-fill-ph := headed-ph.  hd-only-ph := headed-ph.  coord-ph := phrase.\n\n; --- lexeme hierarchy\ninfl-lxm := lexeme.\nconst-lxm := lexeme.\nnoun-lxm := lexeme & [HEAD [noun AGR [PER / 3rd]], MODE / ref, INDEX ref-index].\ncn-lxm := noun-lxm & infl-lxm & [SPR <[AGR #a]>, AGR #a, ARG-ST <DP_i>, INDEX #i].\npn-lxm := noun-lxm & const-lxm & [AGR 3sing, SPR < >, ARG-ST < >].\npron-lxm := noun-lxm & const-lxm & [SPR < >, ARG-ST < >, RESTR < >].\nverb-lxm := infl-lxm & [HEAD verb, SPR <[AGR #a]>, AGR #a, MODE prop, INDEX sit-index, ARG-ST <[ ], ...>].\nsiv-lxm := verb-lxm & [ARG-ST <[ ]>].\nstv-lxm := verb-lxm & [ARG-ST <[ ], NP>].\ndtv-lxm := verb-lxm & [ARG-ST <[ ], NP, NP>].\nptv-lxm := verb-lxm & [ARG-ST <[ ], NP, PP>].\nsrv-lxm := verb-lxm & [ARG-ST <#1, [HEAD verb & [FORM inf], SPR <#1>, COMPS < >]>].\nscv-lxm := verb-lxm & [ARG-ST <NP_i, [HEAD verb & [FORM inf], SPR <NP_i>, COMPS < >]>].\ninf-to-lxm := const-lxm & [HEAD verb & [FORM inf, AUX +], SPR <#1>, ARG-ST <#1, [HEAD verb & [FORM base], SPR <#1>, COMPS < >, INDEX #s]>, MODE prop, INDEX #s, RESTR < >].\ndet-lxm := const-lxm & [HEAD det, SPR < >, ARG-ST < >].\nargmkp-lxm := const-lxm & [HEAD prep, SPR < >, ARG-ST <NP_i>, INDEX #i, RESTR < >].\nadj-lxm := const-lxm & [HEAD adj, SPR < >, ARG-ST < >, MOD <[HEAD noun, SPR <[ ]>, COMPS < >, INDEX #i]>, INDEX #i].\nconj-lxm := const-lxm & [HEAD conj, SPR < >, ARG-ST < >, RESTR < >].\n",
    hpsgLex: "; name := lexical-type & [ \u2026 ].   Optional arguments: <NP, (PP)>.   Irregular forms:\n@irreg sleep past slept\n@irreg sleep psp slept\n@irreg see past saw\n@irreg see psp seen\n@irreg give past gave\n@irreg give psp given\n@irreg child pl children\n\nkim := pn-lxm & [PHON <\"Kim\">, INDEX #i, RESTR <[RELN name, NAME Kim, NAMED #i]>].\nlee := pn-lxm & [PHON <\"Lee\">, INDEX #i, RESTR <[RELN name, NAME Lee, NAMED #i]>].\njohn := pn-lxm & [PHON <\"John\">, INDEX #i, RESTR <[RELN name, NAME John, NAMED #i]>].\ni := pron-lxm & [PHON <\"I\">, HEAD [CASE nom, AGR 1sing]].\ndog := cn-lxm & [PHON <\"dog\">, INDEX #i, RESTR <[RELN dog, INST #i]>].\ncat := cn-lxm & [PHON <\"cat\">, INDEX #i, RESTR <[RELN cat, INST #i]>].\nbook := cn-lxm & [PHON <\"book\">, INDEX #i, RESTR <[RELN book, INST #i]>].\nthe := det-lxm & [PHON <\"the\">, INDEX #i, RESTR <[RELN the, BV #i]>].\na := det-lxm & [PHON <\"a\">, HEAD [COUNT +, AGR 3sing], INDEX #i, RESTR <[RELN exist, BV #i]>].\nsleep := siv-lxm & [PHON <\"sleep\">, ARG-ST <NP_i>, INDEX #s, RESTR <[RELN sleep, SIT #s, SLEEPER #i]>].\ncry := siv-lxm & [PHON <\"cry\">, ARG-ST <NP_i>, INDEX #s, RESTR <[RELN cry, SIT #s, CRYER #i]>].\nsee := stv-lxm & [PHON <\"see\">, ARG-ST <NP_i, NP_j>, INDEX #s, RESTR <[RELN see, SIT #s, SEER #i, SEEN #j]>].\nlove := stv-lxm & [PHON <\"love\">, ARG-ST <NP_i, NP_j>, INDEX #s, RESTR <[RELN love, SIT #s, LOVER #i, LOVED #j]>].\ngive := dtv-lxm & [PHON <\"give\">, ARG-ST <NP_i, NP_j, NP_k>, INDEX #s, RESTR <[RELN give, SIT #s, GIVER #i, RECIPIENT #j, GIFT #k]>].\ngive := ptv-lxm & [PHON <\"give\">, ARG-ST <NP_i, NP_k, PP_j>, INDEX #s, RESTR <[RELN give, SIT #s, GIVER #i, RECIPIENT #j, GIFT #k]>].\ncontinue := srv-lxm & [PHON <\"continue\">, ARG-ST <[ ], [INDEX #t]>, INDEX #s, RESTR <[RELN continue, SIT #s, ARG #t]>].\ntry := scv-lxm & [PHON <\"try\">, ARG-ST <NP_i, [INDEX #t]>, INDEX #s, RESTR <[RELN try, SIT #s, TRIER #i, ARG #t]>].\nto := inf-to-lxm & [PHON <\"to\">].\nto := argmkp-lxm & [PHON <\"to\">].\ngray := adj-lxm & [PHON <\"gray\">, INDEX #i, RESTR <[RELN gray, INST #i]>].\nand := conj-lxm & [PHON <\"and\">].\n",
    hpsgRules: "# Name (i|d|p, morphology): [input] => [output]      i = inflectional (lexeme \u2192 word), d = derivational, p = post-inflectional\nSingular noun (i): [cn-lxm] => [word AGR|NUM sg]\nPlural noun (i, pl): [cn-lxm] => [word AGR|NUM pl]\n3rd-singular verb (i, 3sg): [verb-lxm] => [word HEAD [FORM fin, AGR 3sing], ARG-ST <[CASE nom], ...>]\nNon-3rd-singular verb (i, base): [verb-lxm] => [word HEAD [FORM fin, AGR non-3sing], ARG-ST <[CASE nom], ...>]\nPast tense (i, past): [verb-lxm] => [word HEAD|FORM fin, ARG-ST <[CASE nom], ...>]\nBase form (i, base): [verb-lxm] => [word HEAD|FORM base]\nPresent participle (i, prp): [verb-lxm] => [word HEAD|FORM prp]\nPast participle (i, psp): [verb-lxm] => [word HEAD|FORM psp]\nConstant lexeme (i): [const-lxm] => [word]\nAgent nominal (d, er): [verb-lxm ARG-ST <NP_i, ...>, RESTR #r] => [cn-lxm ARG-ST <DP_i>, INDEX #i, RESTR #r]\n",
    examples: [
      { name: 'John continues to cry (raising)', tree: '[S [NP John] [VP [V continues] [VP [V to] [VP [V cry]]]]]', build: true },
      { name: 'Kim tries to sleep (control)', tree: '[S [NP Kim] [VP [V tries] [VP [V to] [VP [V sleep]]]]]', build: true },
      { name: 'The dog sees Lee', tree: '[S [NP [D the] [N dog]] [VP [V sees] [NP Lee]]]', build: true },
      { name: 'Kim gives the book to Lee', tree: '[S [NP Kim] [VP [V gives] [NP [D the] [N book]] [PP [P to] [NP Lee]]]]', build: true },
      { name: '*I continues to cry (agreement clash)', tree: '[S [NP I] [VP [V continues] [VP [V to] [VP [V cry]]]]]', build: true },
    ],
  };
  const SWB9 = {
    ...HPSG, id: 'swb9', name: 'HPSG — Sag, Wasow & Bender ch. 9 grammar',
    description: 'The grammar summarized at the end of Chapter 9 of Syntactic Theory (2nd ed., §9.2): the type hierarchy and constraints, abbreviations, grammar rules, lexical rules and basic lexicon, with the Case Constraint, Binding Theory and Anaphoric Agreement switched on.',
    categories: 'S\nNP\nVP\nNOM\nV\nN\nD\nDP\nPP\nP\nAP\nA\nConj\nAdv',
    signature: "; Sag, Wasow & Bender (2003), Syntactic Theory, 2nd ed. \u2014 the grammar of Chapter 9 (\u00a79.2 \"The Grammar So Far\").\n; Transcribed type by type from \u00a79.2.1\u20139.2.3. feat-struc is *top*; list and list(\u03c4) are built in.\n; Where the book writes a set of values {a, b, \u2026}, each value is a subtype of a sort (e.g. mode, case).\n; Shorthands (@alias) only make the lexicon shorter to write; the types below spell out full paths.\n@alias HEAD SYN|HEAD\n@alias VAL SYN|VAL\n@alias SPR SYN|VAL|SPR\n@alias COMPS SYN|VAL|COMPS\n@alias MOD SYN|VAL|MOD\n@alias FORM SYN|HEAD|FORM\n@alias AGR SYN|HEAD|AGR\n@alias CASE SYN|HEAD|CASE\n@alias COUNT SYN|HEAD|COUNT\n@alias MODE SEM|MODE\n@alias INDEX SEM|INDEX\n@alias RESTR SEM|RESTR\n@abbrindex SEM|INDEX\n; (37.2) Initial symbol: the root of a well-formed tree\n@root [SYN [HEAD verb & [FORM fin], VAL [COMPS < >, SPR < >]]]\n\n; \u2500\u2500 \u00a79.2.3 Abbreviations (words first, so lexical nodes get V, N, P, A) \u2500\u2500\n@abbr V [word SYN [HEAD verb]]\n@abbr N [word SYN [HEAD noun]]\n@abbr P [word SYN [HEAD prep]]\n@abbr A [word SYN [HEAD adj]]\n@abbr D [word SYN [HEAD det]]\n@abbr Conj [word SYN [HEAD conj]]\n@abbr Adv [word SYN [HEAD adv]]\n@abbr S [SYN [HEAD verb, VAL [COMPS < >, SPR < >]]]\n@abbr VP [SYN [HEAD verb, VAL [COMPS < >, SPR <[ ]>]]]\n@abbr NP [SYN [HEAD noun, VAL [COMPS < >, SPR < >]]]\n@abbr NOM [SYN [HEAD noun, VAL [COMPS < >, SPR <[ ]>]]]\n@abbr PP [SYN [HEAD prep, VAL [COMPS < >]]]\n@abbr AP [SYN [HEAD adj, VAL [COMPS < >]]]\n@abbr DP [SYN [HEAD det, VAL [COMPS < >, SPR < >]]]\n\n; \u2500\u2500 atoms (\u00a79.2.7: A_pol, A_gr.atom, A_mode, A_reln) \u2500\u2500\natom.\nbool := atom.  + := bool.  - := bool.\nmode := atom.  prop := mode.  ques := mode.  dir := mode.  ref := mode.  ana := mode.  none := mode.\nform := atom.  fin := form.  base := form.  prp := form.  psp := form.  pass := form.  to := form.  nform := form.  aform := form.  of := form.\ncase := atom.  nom := case.  acc := case.\nper := atom.  1st := per.  2nd := per.  3rd := per.\nnum := atom.  sg := num.  pl := num.\ngend := atom.  fem := gend.  masc := gend.  neut := gend.\nreln := atom.\nindex.\n\n; \u2500\u2500 \u00a79.2.2 General types \u2500\u2500\npredication := [RELN reln].\nsynsem := [SYN syn-cat, SEM sem-cat].\nsyn-cat := [HEAD pos, VAL val-cat].\nsem-cat := [MODE mode, INDEX index, RESTR list(predication)].\nval-cat := [SPR list(expression), COMPS list(expression), MOD list(expression)].\nexpression := synsem.\nphrase := expression.\nword := expression & [SYN [VAL [SPR #A, COMPS #B]], ARG-ST #A \u2295 #B].\nlexeme := synsem & [SYN [VAL [MOD / < >]], ARG-ST list(expression)].\ninfl-lxm := lexeme & [SYN [HEAD agr-pos & [AGR #1], VAL [SPR <[SYN [HEAD agr-pos & [AGR #1]]]>]]].\nconst-lxm := lexeme.\ncn-lxm := infl-lxm & [SYN [HEAD noun & [AGR [PER 3rd]]], SEM [MODE / ref, INDEX #i], ARG-ST nelist & [FIRST DP_i, REST / < >]].\n\n; lexical rules as types (the book's l-rule hierarchy). Treditor applies the rules listed under\n; Lexical rules; these types record the book's constraints on them.\nl-sequence := nelist & [FIRST atom, REST list].\nl-rule := [INPUT l-sequence & <[ ], [SEM / #2]>, OUTPUT l-sequence & <[ ], [SEM / #2]>].\ni-rule := l-rule & [INPUT <[ ], [lexeme SYN #3, ARG-ST #A]>, OUTPUT <[ ], [word SYN #3, ARG-ST #A]>].\nd-rule := l-rule & [INPUT <[ ], [lexeme SYN / #3]>, OUTPUT <[ ], [lexeme SYN / #3]>].\n\n; \u2500\u2500 Lexeme types \u2500\u2500\nverb-lxm := infl-lxm & [SYN [HEAD verb], SEM [MODE prop], ARG-ST <NP, ...>].\ncntn-lxm := cn-lxm & [ARG-ST <[SYN [HEAD det & [COUNT +]]], ...>].\nmassn-lxm := cn-lxm & [ARG-ST <[SYN [HEAD det & [COUNT -]]], ...>].\nsiv-lxm := verb-lxm & [ARG-ST <[ ]>].\npiv-lxm := verb-lxm & [ARG-ST <[ ], PP>].\ntv-lxm := verb-lxm & [ARG-ST <[ ], NP, ...>].\nstv-lxm := tv-lxm & [ARG-ST <[ ], [ ]>].\ndtv-lxm := tv-lxm & [ARG-ST <[ ], [ ], NP>].\nptv-lxm := tv-lxm & [ARG-ST <[ ], [ ], PP>].\npn-lxm := const-lxm & [SYN [HEAD noun & [AGR [PER 3rd, NUM / sg]]], SEM [MODE ref], ARG-ST / < >].\npron-lxm := const-lxm & [SYN [HEAD noun], SEM [MODE / ref], ARG-ST < >].\nconj-lxm := const-lxm & [SYN [HEAD conj], SEM [MODE none], ARG-ST < >].\nadj-lxm := const-lxm & [SYN [HEAD adj, VAL [SPR <[ ]>, MOD <[SYN [HEAD noun]]>]], SEM [MODE prop], ARG-ST <NP, ...>].\nadv-lxm := const-lxm & [SYN [HEAD adv, VAL [MOD <[SYN [HEAD verb]]>]], SEM [MODE none]].\ndet-lxm := const-lxm & [SYN [HEAD det, VAL [SPR / < >, COMPS < >]], SEM [MODE none]].\npredp-lxm := const-lxm & [SYN [HEAD prep, VAL [SPR <[ ]>, MOD <[ ]>]], SEM [MODE prop, RESTR <[ ]>], ARG-ST <NP, NP>].\nargmkp-lxm := const-lxm & [SYN [HEAD prep, VAL [SPR < >]], SEM [MODE #1, INDEX #2, RESTR < >], ARG-ST <NP & [SEM [MODE #1, INDEX #2]]>].\npart-lxm := const-lxm.\n\n; \u2500\u2500 Other grammatical types \u2500\u2500\npos := [FORM form].\nagr-pos := pos & [AGR agr-cat].\nverb := agr-pos & [AUX bool].\nnoun := agr-pos & [FORM / nform, CASE case].\ndet := agr-pos & [COUNT bool].\nadj := pos & [FORM aform].\nprep := pos.  adv := pos.  conj := pos.\nagr-cat := [PER per, NUM num].\n3sing := agr-cat & [PER 3rd, NUM sg, GEND gend].\nnon-3sing := agr-cat.\n1sing := non-3sing & [PER 1st, NUM sg].\nnon-1sing := non-3sing.\n2sing := non-1sing & [PER 2nd, NUM sg].\nplural := non-1sing & [NUM pl].\n\n; \u2500\u2500 \u00a79.2.4 Grammar rules \u2500\u2500\n; Head-Specifier, Head-Complement and Head-Modifier are the built-in schemata (HPSG tab), with the\n; Head Feature, Valence, Semantic Inheritance and Semantic Compositionality Principles.\n; Coordination is built in too (switch \"Coordination shares FORM and VAL only\" is on for this grammar).\n; (5) Imperative Rule \u2014 not headed, so it is written out as a rule:\nimperative-rule := rule & phrase & [SYN [HEAD verb, VAL [SPR < >]], SEM [MODE dir, INDEX #s, RESTR #r],\n  ARGS <[SYN [HEAD verb & [FORM base], VAL [SPR <NP & [SYN [HEAD [AGR [PER 2nd]]]]>, COMPS < >]], SEM [INDEX #s, RESTR #r]]>].\n",
    hpsgLex: "; \u00a79.2.6 The Basic Lexicon (SWB ch. 9). The book pairs each form with a description: \u27e8she, [\u2026]\u27e9.\n; Here the form is PHON. X, Y, Z in the book are any expression: written [ ] (with [INDEX #i] for X_i).\n@irreg give past gave\n@irreg give psp given\n@irreg die prp dying\n\n; Nouns\nshe := pron-lxm & [PHON <\"she\">, SYN [HEAD [CASE nom, AGR 3sing & [GEND fem]]], SEM [INDEX #i, RESTR <[RELN female, INST #i]>]].\nhim := pron-lxm & [PHON <\"him\">, SYN [HEAD [CASE acc, AGR 3sing & [GEND masc]]], SEM [INDEX #i, RESTR <[RELN male, INST #i]>]].\nthemselves := pron-lxm & [PHON <\"themselves\">, SYN [HEAD [CASE acc, AGR plural & [PER 3rd]]], SEM [MODE ana, INDEX #i, RESTR <[RELN group, INST #i]>]].\nkim := pn-lxm & [PHON <\"Kim\">, SEM [INDEX #i, RESTR <[RELN name, NAME Kim, NAMED #i]>]].\nbook := cntn-lxm & [PHON <\"book\">, SEM [INDEX #i, RESTR <[RELN book, INST #i]>]].\n\n; Verbs\ndie := siv-lxm & [PHON <\"die\">, ARG-ST <[SEM [INDEX #i]]>, SEM [INDEX #s, RESTR <[RELN die, SIT #s, CORPSE #i]>]].\nlove := stv-lxm & [PHON <\"love\">, ARG-ST <[SEM [INDEX #i]], [SEM [INDEX #j]]>, SEM [INDEX #s, RESTR <[RELN love, SIT #s, LOVER #i, LOVED #j]>]].\ngive := dtv-lxm & [PHON <\"give\">, ARG-ST <[SEM [INDEX #i]], [SEM [INDEX #j]], [SEM [INDEX #k]]>, SEM [INDEX #s, RESTR <[RELN give, SIT #s, GIVER #i, GIVEN #j, GIFT #k]>]].\ngive := ptv-lxm & [PHON <\"give\">, ARG-ST <[SEM [INDEX #i]], [SEM [INDEX #k]], [SYN [HEAD [FORM to]], SEM [INDEX #j]]>, SEM [INDEX #s, RESTR <[RELN give, SIT #s, GIVER #i, GIVEN #j, GIFT #k]>]].\n\n; Miscellaneous\nthe := det-lxm & [PHON <\"the\">, SEM [INDEX #i, RESTR <[RELN the, BV #i]>]].\nfew := det-lxm & [PHON <\"few\">, SYN [HEAD [AGR [NUM pl], COUNT +]], SEM [INDEX #i, RESTR <[RELN few, BV #i]>]].\n's := det-lxm & [PHON <\"'s\">, SYN [VAL [SPR <NP>]], SEM [INDEX #i, RESTR <[RELN the, BV #i], ...>]].\nto := argmkp-lxm & [PHON <\"to\">, SYN [HEAD [FORM to]]].\nin := predp-lxm & [PHON <\"in\">, ARG-ST <NP_i, NP_j>, SEM [INDEX #s, RESTR <[RELN in, SIT #s, CONTAINER #j, CONTAINED #i]>]].\nand := conj-lxm & [PHON <\"and\">, SEM [INDEX #s, RESTR <[RELN and, SIT #s]>]].\ntoday := adv-lxm & [PHON <\"today\">, SYN [VAL [SPR < >, COMPS < >, MOD <VP & [SEM [INDEX #s]]>]], SEM [RESTR <[RELN today, ARG #s]>]].\n",
    hpsgRules: "# \u00a79.2.5 Lexical rules (SWB ch. 9).   Name (i|d, morphology): [input] => [output]\n#   i = i-rule (lexeme \u2192 word: SYN and ARG-ST carried over), d = d-rule (lexeme \u2192 lexeme, SYN/SEM by default identity)\n#   morphology: pl = F_NPL, 3sg = F_3SG, past = F_PAST, prp = F_PRP, psp = F_PSP, er = F_-er (irregulars: @irreg in the lexicon)\nSingular Noun (i): [cn-lxm] => [word SYN [HEAD [AGR [NUM sg]]]]\nPlural Noun (i, pl): [cntn-lxm] => [word SYN [HEAD [AGR [NUM pl]]]]\n3rd-Singular Verb (i, 3sg): [verb-lxm] => [word SYN [HEAD [FORM fin, AGR 3sing]], ARG-ST <[SYN [HEAD [CASE nom]]], ...>]\nNon-3rd-Singular Verb (i): [verb-lxm] => [word SYN [HEAD [FORM fin, AGR non-3sing]], ARG-ST <[SYN [HEAD [CASE nom]]], ...>]\nPast-Tense Verb (i, past): [verb-lxm] => [word SYN [HEAD [FORM fin]], ARG-ST <[SYN [HEAD [CASE nom]]], ...>]\nBase Form (i): [verb-lxm] => [word SYN [HEAD [FORM base]]]\nConstant Lexeme (i): [const-lxm] => [word]\nPresent Participle (d, prp): [verb-lxm ARG-ST #B] => [part-lxm SYN [HEAD [FORM prp]], ARG-ST #B]\nPast Participle (d, psp): [verb-lxm ARG-ST #B] => [part-lxm SYN [HEAD [FORM psp]], ARG-ST #B]\nAgent Nominalization (d, er): [verb-lxm SEM [INDEX #s], ARG-ST <[SEM [INDEX #i]], NP_j>] => [cntn-lxm SEM [INDEX #i], ARG-ST <[ ], (PP_j & [SYN [HEAD [FORM of]]])>]\n",
    hpsgPrinciples: { caseC: true, binding: true, aap: true, coordForm: true, gap: false, headOnly: false, leafTypes: true },
    labelAvms: "# Label: default feature structure \u2014 the abbreviations of \u00a79.2.3\nS: [phrase SYN [HEAD verb, VAL [COMPS < >, SPR < >]]]\nVP: [phrase SYN [HEAD verb, VAL [COMPS < >, SPR <[ ]>]]]\nNP: [phrase SYN [HEAD noun, VAL [COMPS < >, SPR < >]]]\nNOM: [phrase SYN [HEAD noun, VAL [COMPS < >, SPR <[ ]>]]]\nPP: [phrase SYN [HEAD prep, VAL [COMPS < >]]]\nAP: [phrase SYN [HEAD adj, VAL [COMPS < >]]]\nDP: [SYN [HEAD det, VAL [COMPS < >, SPR < >]]]\nV: [word SYN [HEAD verb]]\nN: [word SYN [HEAD noun]]\nP: [word SYN [HEAD prep]]\nA: [word SYN [HEAD adj]]\nD: [word SYN [HEAD det]]\n",
    examples: [{"name": "Kim loves him", "tree": "[S [NP Kim] [VP [V loves] [NP him]]]", "build": true}, {"name": "She gives the book to Kim (ptv-lxm give)", "tree": "[S [NP she] [VP [V gives] [NP [D the] [N book]] [PP [P to] [NP Kim]]]]", "build": true}, {"name": "Kim died today (Head-Modifier)", "tree": "[S [NP Kim] [VP [VP [V died]] [Adv today]]]", "build": true}, {"name": "Kim loves him and the book (Coordination)", "tree": "[S [NP Kim] [VP [V loves] [NP [NP him] [Conj and] [NP [D the] [N book]]]]]", "build": true}, {"name": "Love him! (Imperative Rule)", "tree": "[S [VP [V love] [NP him]]]", "build": true}, {"name": "*Kim love him (agreement: SHAC)", "tree": "[S [NP Kim] [VP [V love] [NP him]]]", "build": true}, {"name": "*Kim loves she (Case Constraint)", "tree": "[S [NP Kim] [VP [V loves] [NP she]]]", "build": true}, {"name": "*Kim_i loves themselves_i (Anaphoric Agreement)", "build": true, "doc": {"arrows": [], "roots": [{"id": "b1", "label": "S", "ch": [{"id": "b2", "label": "NP", "ch": [{"id": "b3", "label": "N", "ch": [{"id": "b4", "label": "Kim", "ch": []}]}], "avm": "[SEM [INDEX #1]]"}, {"id": "b5", "label": "VP", "ch": [{"id": "b6", "label": "V", "ch": [{"id": "b7", "label": "loves", "ch": []}]}, {"id": "b8", "label": "NP", "ch": [{"id": "b9", "label": "N", "ch": [{"id": "b10", "label": "themselves", "ch": []}]}], "avm": "[SEM [INDEX #1]]"}]}]}]}}, {"name": "*Kim_i loves him_i (Binding, Principle B)", "build": true, "doc": {"arrows": [], "roots": [{"id": "c1", "label": "S", "ch": [{"id": "c2", "label": "NP", "ch": [{"id": "c3", "label": "N", "ch": [{"id": "c4", "label": "Kim", "ch": []}]}], "avm": "[SEM [INDEX #1]]"}, {"id": "c5", "label": "VP", "ch": [{"id": "c6", "label": "V", "ch": [{"id": "c7", "label": "loves", "ch": []}]}, {"id": "c8", "label": "NP", "ch": [{"id": "c9", "label": "N", "ch": [{"id": "c10", "label": "him", "ch": []}]}], "avm": "[SEM [INDEX #1]]"}]}]}]}}],
  };
  const TEMPLATES = [
    '# Name: trigger => [structure]',
    '#   trigger $XP matches VP, DP, TP… ($X = V, D, T…); * matches anything; _ = a slot (Tab jumps to the next)',
    'X-bar phrase: $XP => [$XP _ [$X\' [$X _] _]]',
    'X-bar phrase, no specifier: $XP => [$XP [$X\' [$X _] _]]',
    'X-bar phrase + adjunct: $XP => [$XP _ [$X\' [$X\' [$X _] _] _]]',
    'Head + complement: $XP => [$XP [$X _] _]',
    'Head + word: $XP => [$XP [$X _]]',
    'Bar level: $X\' => [$X\' [$X _] _]',
    'Coordination: $XP => [$XP [$XP _] [Conj _] [$XP _]]',
    'Triangle: $XP => [$XP^ _]',
    'Clause: S => [S [NP _] [VP [V _] _]]',
    'Two daughters: * => [$0 _ _]',
    'Three daughters: * => [$0 _ _ _]',
  ].join('\n');
  [SYN, HK, XBAR, MP, TG, PL, ARITH, BLANK, HPSG, HPSG_EX].forEach(p => { if (p.templates === undefined) p.templates = TEMPLATES; });
  PL.templates = '# Name: trigger => [structure]\nNegation: ¬ => [¬ _]\nBinary connective: * => [$0 _ _]';
  ARITH.templates = 'Binary operation: * => [$0 _ _]';
  const presets = [SYN, HPSG, HPSG_EX, SWB9, HK, XBAR, MP, TG, PL, ARITH, BLANK];

  const lessons = [
    {
      id: 'keys', title: 'Type the tree in your head — fast', theory: 'syn', tree: '', features: {},
      steps: [
        'Press <b>Start typing</b> (or just type on the empty canvas): type <b>S</b>.',
        '<kbd>Tab</kbd> = new <i>daughter</i>. Type <b>NP</b>, <kbd>Tab</kbd>, <b>Kim</b>.',
        '<kbd>Shift</kbd>+<kbd>Tab</kbd> = go back up a level and add a sister (like closing a bracket). Type <b>VP</b>.',
        '<b>Templates:</b> with <b>VP</b> typed, press <kbd>↓</kbd> and <kbd>Enter</kbd> on <i>Head + complement</i>. The skeleton appears and you are in its first slot: type <b>V</b>’s word, <kbd>Tab</kbd> to the next slot, and so on. Empty slots you skip disappear.',
        'Slots can be expanded too: type <b>DP</b> in a slot and pick a template again. Edit the templates (Build → Templates → edit) to match your theory.',
      ],
    },
    {
      id: 'bottomup', title: 'Only have the sentence? Build bottom-up', theory: 'syn', tree: '', features: {},
      steps: [
        'Type a sentence into the box on the canvas and press <kbd>Enter</kbd>. Every word becomes its own node.',
        'Select the words of a constituent: <b>drag a box</b> around them, or click one and <kbd>Shift</kbd>-click the others.',
        'Now just <b>type its label</b> (e.g. <b>NP</b>) and press <kbd>Enter</kbd> — the words are grouped under it. Clicking a label chip in the left panel does the same.',
        'Keep grouping phrases until you have one tree. Single word? Select it and type <kbd>Ctrl</kbd>+<kbd>↑</kbd> (or press ＋↑ in its toolbar) to give it a mother.',
      ],
    },
    {
      id: 'move', title: 'Movement, arrows & coindexing', theory: 'syn', features: {},
      tree: "[CP [C' [C ∅] [TP [DP she] [T' [T will] [VP [V' [V draw] [DP what]]]]]]]",
      steps: [
        'In the canvas toolbar switch to <b>Drag to transform</b> (or hold <kbd>Shift</kbd> while dragging). Next to it, choose what is left behind: a trace, a copy, nothing or a placeholder.',
        'Drag <b>DP</b> (above “what”) onto the <b>left edge</b> of <b>C′</b>: it lands in Spec,CP and leaves a coindexed trace with an arrow.',
        'Any other arrow: select a node, press <b>↷</b> in its toolbar, then click the target. Click an arrow to label, restyle or delete it.',
        'Coindexing: select two nodes and press <b>ᵢ</b> — both get the same subscript. Typing <b>t_i</b> anywhere also links a trace to its antecedent automatically.',
      ],
    },
    {
      id: 'style', title: 'Triangles, colours, notes & more', theory: 'syn', exampleIndex: 0, features: {},
      steps: [
        '<b>Right-click</b> any node (long-press on touch) for every action: triangle, unpronounced, dashed branch, colour, box/circle, notes, features…',
        'Select <b>VP</b> and press <b>△</b> to collapse it under a triangle.',
        'Add a <b>note</b> under a word for a gloss or θ-role. Add <b>features</b> such as <i>+wh</i> or <i>uφ</i>.',
        'Export as PNG, SVG or LaTeX (forest/qtree) from the Export menu — arrows, triangles and colours come along.',
      ],
    },
    {
      id: 'fa', title: 'Semantics: Function Application', theory: 'hk', tree: '[S [DP Mary] [VP [V loves] [DP John]]]', features: { sem: true },
      steps: [
        'Each node shows its <b>type</b> and <b>denotation</b>; the root also shows its truth value in the model.',
        'Click the <b>VP</b>. The inspector shows which rule applied (FA) and the unreduced term.',
        'Press <b>β-reduce step by step</b> to watch the λ-conversion one redex at a time.',
        'Press <b>▶ Compose</b> in the canvas toolbar to animate the whole bottom-up computation.',
      ],
    },
    {
      id: 'qr', title: 'Quantifier Raising & Predicate Abstraction', theory: 'hk', tree: '[S [DP Mary] [VP [V loves] [DP [D every] [NP [N cat]]]]]', features: { sem: true },
      steps: [
        'The VP is red: ⟨e,⟨e,t⟩⟩ cannot combine with ⟨⟨e,t⟩,t⟩ — the classic object-quantifier type clash.',
        'Hold <kbd>Shift</kbd> and drag the object <b>DP</b> onto the <b>top edge</b> of <b>S</b> (the hint says “adjoin above”).',
        'Treditor leaves the trace t₁, indexes the DP and inserts the binder 1 — Predicate Abstraction now makes the types work.',
      ],
    },
    {
      id: 'merge', title: 'Merge and Move', theory: 'mp', exampleIndex: 0, features: {},
      steps: [
        'These are the lexical items of the numeration. Click <b>D the</b>, then <kbd>Shift</kbd>-click <b>N cat</b> and press <b>Merge</b> (<kbd>Ctrl</kbd>+<kbd>M</kbd>). The first selected item projects its label.',
        'Or drag one tree onto the top edge of another to Merge them.',
        'Internal Merge: select a node <i>inside</i> a tree plus that tree’s root and Merge — the moved item leaves an unpronounced ⟨copy⟩.',
      ],
    },
    {
      id: 'tg', title: 'Transformations as tree rewriting', theory: 'tg', exampleIndex: 0, features: { tx: true, deriv: true }, tab: 'transform',
      steps: [
        'The <b>Transform</b> tab lists rules: each is a pattern ⇒ result over trees.',
        'Click the root S, then press <b>Apply</b> on <i>Passive</i>: watch the NPs swap places.',
        'Then apply <i>Subject-Aux Inversion</i>. Every step is recorded on the timeline; ▶ Play replays it.',
        'Write your own: <code>?x</code> = subtree, <code>?x*</code> = any sisters, <code>$X</code> = any label.',
      ],
    },
    {
      id: 'nnf', title: 'Normal forms in logic', theory: 'pl', exampleIndex: 0, features: { sem: true, tx: true, deriv: true }, tab: 'transform',
      steps: [
        'The root shows the truth value of the formula in the model (Model tab).',
        'Press <b>Normalize</b>: rules are applied until none match — negation normal form — and the steps are played back.',
      ],
    },
    {
      id: 'lambda', title: 'λ-calculator', theory: 'hk', tree: '[S [DP John] [VP [V smokes]]]', tab: 'model', features: { sem: true },
      steps: [
        'The Model tab has a free λ-calculator. Try <code>(λP.λQ.∀x.P(x) → Q(x))(cat)(sleeps)</code>.',
        'You get its type, every β-reduction step, and its value in the model. Edit the model and every tree updates live.',
      ],
    },
  ];

  return { presets, lessons, byId: id => presets.find(p => p.id === id) };
})();
