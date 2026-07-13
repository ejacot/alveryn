export type ExcelImportResult = {
  fileName: string;
  detectedYear: number;
  workTypeName: string;
  importedEntries: number;
  importedAbsences: number;
  createdWorkTypes: number;
  skippedRows: number;
  warnings: string[];
};
