import { TableSelection } from "./TableSelection";

describe("TableSelection", () => {
  let selection: TableSelection;

  beforeEach(() => {
    selection = new TableSelection();
  });

  const tests = [
    { l: "$", r: "", expected: true },
    { l: "$", r: "25", expected: true },
  ];

  describe.each(tests)(`canMergeCells`, ({ l, r, expected }) => {
    test(`(${l}, ${r}) => ${expected}`, () => {
      expect(selection.canMergeCells(l, r)).toBe(expected);
    });
  });
});
