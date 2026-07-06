import { Project, Node } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const functionMap = new Map<
  string,
  { file: string; line: number }[]
>();

for (const sourceFile of project.getSourceFiles()) {
  // function foo() {}
  sourceFile.getFunctions().forEach((fn) => {
    const name = fn.getName();
    if (!name) return;

    add(name, sourceFile.getFilePath(), fn.getStartLineNumber());
  });

  // const foo = () => {}
  // const foo = function() {}
  sourceFile.getVariableDeclarations().forEach((decl) => {
    const initializer = decl.getInitializer();

    if (
      initializer &&
      (Node.isArrowFunction(initializer) ||
        Node.isFunctionExpression(initializer))
    ) {
      add(
        decl.getName(),
        sourceFile.getFilePath(),
        decl.getStartLineNumber()
      );
    }
  });
}

let found = false;

for (const [name, locations] of functionMap) {
  if (locations.length > 1) {
    found = true;

    console.log(`\n❌ Duplicate function: ${name}`);

    for (const loc of locations) {
      console.log(`   ${loc.file}:${loc.line}`);
    }
  }
}

if (!found) {
  console.log("✅ No duplicate function names found.");
}

function add(name: string, file: string, line: number) {
  if (!functionMap.has(name)) {
    functionMap.set(name, []);
  }

  functionMap.get(name)!.push({
    file,
    line,
  });
}