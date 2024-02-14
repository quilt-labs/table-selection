export interface TableSelectionConfig {
    copyOnSelection?: boolean;
    copyOnSelectionCallback?: (text: string) => any;
    rootDocument: Document;
    selector?: string;
    selectionCssMode?: 'style' | 'cssClass';
    selectionCssClass?: string | null;
}
