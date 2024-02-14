export interface TableSelectionConfig {
    rootDocument: Document;
    selector?: string;
    selectionCssMode?: 'style' | 'cssClass';
    selectionCssClass?: string | null;
}
