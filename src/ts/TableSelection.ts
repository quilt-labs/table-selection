/*!
 * TableSelection library v1.0.0 (https://github.com/PXLWidgets/table-selection)
 * Copyright (c) 2019 Wouter Smit
 * Licensed under MIT (https://github.com/PXLWidgets/table-selection/blob/master/LICENSE)
 */

import { TableSelectionConfig } from "./interfaces/TableSelectionConfig";
import { TableSelectionRange } from "./interfaces/TableSelectionRange";
import { TableSelectionTableElements } from "./interfaces/TableSelectionTableElements";

const defaultConfig: TableSelectionConfig = {
  copyOnSelection: false,
  rootDocument: document,
  selector: ".table-selection",
  selectionCssMode: "style",
  selectionCssClass: "selected",
};

export class TableSelection {
  config: TableSelectionConfig;
  range: TableSelectionRange | null = null;
  elements: TableSelectionTableElements;

  constructor(config: TableSelectionConfig = defaultConfig) {
    this.config = { ...config };

    const { rootDocument } = this.config;

    // Hide default selection
    const styles = rootDocument.createElement("style");
    styles.innerHTML = `${this.config.selector} *::selection {
            background: transparent;
            color: inherit;
        }`;
    rootDocument.head.appendChild(styles);

    rootDocument.addEventListener("selectionchange", () =>
      this.onSelectionChange()
    );
    rootDocument.addEventListener("copy", (e) => this.handleCopy(e));
  }

  protected async onSelectionChange(): Promise<void> {
    const selection = this.config.rootDocument.getSelection();

    this.deselect();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const startCell: HTMLTableCellElement | null = this.getCellElementFromNode(
      selection.anchorNode
    );
    const endCell: HTMLTableCellElement | null = this.getCellElementFromNode(
      selection.focusNode
    );

    if (!startCell || !endCell) {
      return;
    }

    const startTableElements = this.getTableElementsFromCellElement(startCell);
    const endTableElements = this.getTableElementsFromCellElement(endCell);
    if (!startTableElements || !endTableElements) {
      return;
    }

    const isSameTable = startTableElements.table === endTableElements.table;
    if (!isSameTable) {
      return;
    }

    this.elements = startTableElements;

    this.getRangeByStartAndEndElement(startCell, endCell);
    this.getRowElements();
    this.getRowsAndCells();

    if (this.range) {
      if (this.config.copyOnSelection) {
        const selectionText = this.getSelectionText(this.range);
        await this.copyToClipboard(selectionText);
      }

      this.select();
    } else {
      this.deselect();
    }
  }

  protected getRangeByStartAndEndElement(
    startCellElement: HTMLTableCellElement,
    endCellElement: HTMLTableCellElement
  ): void {
    const startRowElement: HTMLTableRowElement | null =
      startCellElement.parentElement as HTMLTableRowElement;
    const endRowElement: HTMLTableRowElement | null =
      endCellElement.parentElement as HTMLTableRowElement;

    if (!startRowElement || !endRowElement) {
      return;
    }

    this.range = {
      start: {
        row: startRowElement.rowIndex + 1,
        cell: startCellElement.cellIndex + 1,
      },
      end: {
        row: endRowElement.rowIndex + 1,
        cell: endCellElement.cellIndex + 1,
      },
      rowElements: [],
      rows: [],
      cells: [],
    };

    // Flip start/end if end > start
    if (this.range.start.cell > this.range.end.cell) {
      [this.range.start.cell, this.range.end.cell] = [
        this.range.end.cell,
        this.range.start.cell,
      ];
    }
    if (this.range.start.row > this.range.end.row) {
      [this.range.start.row, this.range.end.row] = [
        this.range.end.row,
        this.range.start.row,
      ];
    }
  }

  protected getRowElements(): void {
    if (!this.range || !this.elements.table) {
      return;
    }

    const numTableHeaders =
      this.elements.table.querySelectorAll("thead tr").length;
    let theadRows: HTMLTableRowElement[] = [];
    let tbodyRows: HTMLTableRowElement[] = [];

    const theadStart =
      this.range.start.row <= numTableHeaders
        ? Math.min(numTableHeaders, this.range.start.row)
        : null;
    const theadEnd =
      this.range.start.row <= numTableHeaders
        ? Math.min(numTableHeaders, this.range.end.row)
        : null;

    const tbodyStart =
      this.range.end.row > numTableHeaders
        ? Math.max(1, this.range.start.row - numTableHeaders)
        : null;
    const tbodyEnd =
      this.range.end.row > numTableHeaders
        ? Math.max(1, this.range.end.row - numTableHeaders)
        : null;

    if (theadStart) {
      theadRows = Array.from(
        this.elements.table.querySelectorAll(
          `thead tr:nth-of-type(n+${theadStart}):nth-of-type(-n+${theadEnd})`
        )
      );
    }

    if (tbodyStart) {
      tbodyRows = Array.from(
        this.elements.table.querySelectorAll(
          `tbody tr:nth-of-type(n+${tbodyStart}):nth-of-type(-n+${tbodyEnd})`
        )
      );
    }

    this.range.rowElements = [...theadRows, ...tbodyRows];
  }

  protected getRowsAndCells(): void {
    if (!this.range || !this.range.rowElements) {
      return;
    }

    let cells: HTMLTableCellElement[] = [];
    this.range.rowElements.forEach((row: HTMLTableRowElement, i: number) => {
      if (!this.range) {
        return;
      }

      const cellsInRow = Array.from(
        row.querySelectorAll(
          [
            `td:nth-of-type(n+${this.range.start.cell}):nth-of-type(-n+${this.range.end.cell})`,
            `th:nth-of-type(n+${this.range.start.cell}):nth-of-type(-n+${this.range.end.cell})`,
          ].join(",")
        )
      ) as HTMLTableCellElement[];

      cells = [...cells, ...cellsInRow];
      this.range.rows[i] = cellsInRow;
    });

    this.range.cells = cells;
  }

  protected getCellElementFromNode(
    inputNode: Node | null
  ): HTMLTableCellElement | null {
    if (!inputNode) {
      return null;
    }

    const element: HTMLTableCellElement | null =
      inputNode.nodeName === "#text"
        ? (inputNode.parentElement as HTMLTableCellElement).closest("td,th")
        : (inputNode as HTMLTableCellElement);

    if (!element || !["TD", "TH"].includes(element.tagName)) {
      return null;
    }

    return element;
  }

  protected getTableElementsFromCellElement(
    cellElement: HTMLTableCellElement
  ): TableSelectionTableElements | null {
    if (
      !cellElement ||
      !cellElement.parentElement ||
      !cellElement.parentElement.parentElement
    ) {
      return null;
    }

    const tHeadOrBody = cellElement.parentElement.parentElement;
    const table: HTMLTableElement = ["TBODY", "THEAD"].includes(
      tHeadOrBody.tagName
    )
      ? (tHeadOrBody.parentElement as HTMLTableElement)
      : (tHeadOrBody as HTMLTableElement);

    if (
      !table ||
      !this.config.selector ||
      !table.matches(this.config.selector)
    ) {
      return null;
    }

    return {
      table,
      thead: table.querySelector("thead") as HTMLTableSectionElement,
      tbody: table.querySelector("tbody") as HTMLTableSectionElement,
    };
  }

  protected select(): void {
    if (this.range && this.range.cells) {
      this.range.cells.forEach((cellElement) => {
        if (
          this.config.selectionCssMode === "cssClass" &&
          this.config.selectionCssClass
        ) {
          cellElement.classList.add(this.config.selectionCssClass);
        } else {
          cellElement.style.backgroundColor =
            "var(--table-selection-background-color, Highlight)";
          cellElement.style.color =
            "var(--table-selection-color, HighlightText)";
        }
      });
    }
  }

  protected deselect(): void {
    if (this.range && this.range.cells) {
      this.range.cells.forEach((cellElement) => {
        if (
          this.config.selectionCssMode === "cssClass" &&
          this.config.selectionCssClass
        ) {
          cellElement.classList.remove(this.config.selectionCssClass);
        } else {
          cellElement.style.removeProperty("background-color");
          cellElement.style.removeProperty("color");
        }
      });
      this.range = null;
    }
  }

  protected handleCopy(e: ClipboardEvent): void {
    if (!this.range || !this.range.rows || !e.clipboardData) {
      return;
    }

    const selectionText = this.getSelectionText(this.range);

    if (!selectionText) {
      return;
    }

    e.clipboardData.setData("text/plain", selectionText);
    e.preventDefault();
  }

  protected getSelectionText(range: TableSelectionRange): string {
    // get number of rows and cells in range
    const n_rows = range.rows.length;
    const n_cells = range.rows[0].length;

    // store array of innerText of each cell in range
    const cellTexts: string[][] = [];
    for (let i = 0; i < n_rows; i++) {
      cellTexts.push([]);
      for (let j = 0; j < n_cells; j++) {
        cellTexts[i].push(range.rows[i][j].innerText.trim());
      }
    }

    // merge columns that can be merged
    const mergedCellTexts = this.mergeCellTexts(cellTexts);

    // manipulate merged cell texts
    const manipulatedMergedCellTexts =
      this.manipulateMergedCellTexts(mergedCellTexts);

    // for each thing in cellTexts, mergedCellTexts, and manipulatedMergedCellTexts, log it with the name
    // console.log("cellTexts");
    // console.log(cellTexts);

    // console.log("mergedCellTexts");
    // console.log(mergedCellTexts);

    // console.log("manipulatedMergedCellTexts");
    // console.log(manipulatedMergedCellTexts);

    // join cellTexts
    const cellTextsJoined = manipulatedMergedCellTexts
      .map((row) => row.join("\t"))
      .join("\r\n");

    return cellTextsJoined;
  }

  protected manipulateMergedCellTexts(mergedCellTexts: string[][]): string[][] {
    /* manipulate merged cell texts */

    // manipulate each cell text
    for (let i = 0; i < mergedCellTexts.length; i++) {
      for (let j = 0; j < mergedCellTexts[i].length; j++) {
        mergedCellTexts[i][j] = this.manipulateString(mergedCellTexts[i][j]);
      }
    }

    return mergedCellTexts;
  }

  manipulateString(input: string): string {
    // Replace any type of dash with a '0' but only if there is no text characters in input
    if (!input.match(/[a-zA-Z]/)) {
      input = input.replace(/[-–—]/g, "0");
    }
    // Replace the opening parenthesis with a negative sign if there's no closing parenthesis
    const hasOpeningWithoutClosing =
      input.includes("(") && !input.includes(")");
    if (hasOpeningWithoutClosing) {
      input = input.replace("(", "-");
    }

    return input;
  }

  canMergeCells(
    str1: string,
    str2: string,
    allowedUnits: string[] = ["$", "%", "bps", "pts"]
  ): boolean {
    // Check if one of the string is empty
    if (str1 === "" || str2 === "") return true;

    // Check if exactly one of them contains an allowed unit
    const containsAllowedUnit = (str: string) =>
      allowedUnits.some((unit) => str.includes(unit));

    const isNumericOrSpecial = (str: string) => /^[0-9.,()-]+$/.test(str);

    if (containsAllowedUnit(str1) && isNumericOrSpecial(str2)) return true;
    if (containsAllowedUnit(str2) && isNumericOrSpecial(str1)) return true;

    // Check if upon merging, they form a valid parenthetical number
    const mergedString = str1 + str2;
    const validParentheticalNumberRegex = /^\(\$?\d{1,3}(,\d{3})*(\.\d+)?\)%?$/;
    return validParentheticalNumberRegex.test(mergedString);
  }

  protected canMergeColumns(colA: string[], colB: string[]): boolean {
    /* check if two columns can be merged */

    // if the columns have different lengths, they cannot be merged
    if (colA.length !== colB.length) {
      return false;
    }

    // check if the columns can be merged
    for (let i = 0; i < colA.length; i++) {
      if (!this.canMergeCells(colA[i], colB[i])) {
        return false;
      }
    }

    return true;
  }

  protected mergeColumns(colA: string[], colB: string[]): string[] {
    /* merge two columns */
    const mergedCol: string[] = [];

    for (let i = 0; i < colA.length; i++) {
      mergedCol.push(colA[i] + colB[i]);
    }

    return mergedCol;
  }

  protected mergeCellTexts(cellTexts: string[][]): string[][] {
    /* merge columns that can be merged */

    // ensure that cellTexts is rectangular
    const n_rows = cellTexts.length;
    const n_cells = cellTexts[0].length;
    if (!cellTexts.every((row) => row.length === n_cells)) {
      throw new Error("cellTexts is not rectangular");
    }

    // maintain an output array of merged cellTexts starting with the first column
    const mergedCellTexts: string[][] = [cellTexts.map((row) => row[0])];

    // iterate over the columns. If a column can be merged with the previous one, merge them
    // otherwise, add the column to the output array
    for (let i = 1; i < n_cells; i++) {
      // get the last column in the output array
      const prevCol = mergedCellTexts[mergedCellTexts.length - 1];
      // get the current column
      const curCol = cellTexts.map((row) => row[i]);

      if (this.canMergeColumns(prevCol, curCol)) {
        mergedCellTexts[mergedCellTexts.length - 1] = this.mergeColumns(
          prevCol,
          curCol
        );
      } else {
        mergedCellTexts.push(curCol);
      }
    }

    // transpose the output array to get the final merged cellTexts
    const mergedCellTextsTransposed: string[][] = [];
    for (let i = 0; i < mergedCellTexts[0].length; i++) {
      mergedCellTextsTransposed.push(mergedCellTexts.map((row) => row[i]));
    }

    return mergedCellTextsTransposed;
  }

  protected async copyToClipboard(text: string): Promise<void> {
    // console.log(`copying to clipboard: ${text}`)
    const window = this.config.rootDocument.defaultView;

    if (window === null) {
      console.warn(
        "TableSelection: Could not access window, aborting copy to clipboard!"
      );

      return;
    }

    await window.navigator.clipboard.writeText(text);
    // console.log(`copied to clipboard: ${text}`)

    if (this.config.copyOnSelectionCallback !== undefined) {
      // console.log(`calling copyOnSelectionCallback with text=${text}`)
      this.config.copyOnSelectionCallback(text);
    }
  }
}
