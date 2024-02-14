export interface TableSelectionConfig {
    copyOnSelection: boolean;
    rootDocument: Document;
    selector?: string;
    selectionCssMode?: 'style' | 'cssClass';
    selectionCssClass?: string | null;
}
