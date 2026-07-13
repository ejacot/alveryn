export type ExcelImportRecognizedSheet = {
  sheetName: string;
  month: number;
  workEntries: number;
  absences: number;
  skippedRows: number;
};

export type ExcelImportWarning = {
  code: string;
  message: string;
};

export type ExcelImportConflict = {
  code: string;
  workDate: string | null;
  sourceKey: string;
  message: string;
};

export type ExcelImportDuplicateCandidate = {
  type: string;
  workDate: string | null;
  sourceKey: string;
  message: string;
};

export type ExcelImportPreview = {
  fileName: string;
  detectedYear: number;
  recognizedSheets: ExcelImportRecognizedSheet[];
  totals: {
    workEntries: number;
    absences: number;
    skippedRows: number;
  };
  ignoredSheets: string[];
  warnings: ExcelImportWarning[];
  conflicts: ExcelImportConflict[];
  duplicateCandidates: ExcelImportDuplicateCandidate[];
  canImport: boolean;
  previewToken: string | null;
  previewBatchId: string | null;
};

export type ExcelImportConfirmResult = {
  batchId: string;
  fileName: string;
  detectedYear: number;
  workTypeName: string | null;
  importedEntries: number;
  importedAbsences: number;
  skippedRows: number;
  warnings: string[];
};

export type ExcelImportBatchSummary = {
  id: string;
  fileName: string;
  detectedYear: number;
  status: "PREVIEWED" | "COMPLETED" | "UNDONE" | "FAILED";
  importedEntriesCount: number;
  importedAbsencesCount: number;
  skippedRowsCount: number;
  warningCount: number;
  createdAt: string;
  confirmedAt: string | null;
  undoneAt: string | null;
};

export type ExcelImportBatchDetail = {
  id: string;
  fileName: string;
  detectedYear: number;
  status: "PREVIEWED" | "COMPLETED" | "UNDONE" | "FAILED";
  recognizedSheetsCount: number;
  importedEntriesCount: number;
  importedAbsencesCount: number;
  skippedRowsCount: number;
  warningCount: number;
  createdAt: string;
  previewedAt: string | null;
  confirmedAt: string | null;
  undoneAt: string | null;
  importedWorkTypeName: string | null;
  undoAvailable: boolean;
  warnings: string[];
};
