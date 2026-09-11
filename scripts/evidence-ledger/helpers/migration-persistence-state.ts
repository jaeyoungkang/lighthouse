export interface ResearchPersistenceState {
  documentsExists: boolean;
  gapReportsExists: boolean;
  gapReportsMetadataTypeConstrained: boolean;
}

function normalizeSqlStatements(source: string): string[] {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n\r]*/g, " ")
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function hasGapReportsMetadataTypeConstraint(statement: string): boolean {
  return (
    /\bgap_reports_metadata_type_check\b/i.test(statement) &&
    /metadata\s*->>\s*'type'\s*=\s*'gap_network'/i.test(statement)
  );
}

export function deriveResearchPersistenceState(
  orderedMigrationSources: readonly string[],
): ResearchPersistenceState {
  const state: ResearchPersistenceState = {
    documentsExists: false,
    gapReportsExists: false,
    gapReportsMetadataTypeConstrained: false,
  };

  for (const source of orderedMigrationSources) {
    for (const statement of normalizeSqlStatements(source)) {
      if (/^create\s+table\s+(?:if\s+not\s+exists\s+)?lighthouse\.documents\b/i.test(statement)) {
        state.documentsExists = true;
        continue;
      }
      if (/^drop\s+table\s+(?:if\s+exists\s+)?lighthouse\.documents\b/i.test(statement)) {
        state.documentsExists = false;
        continue;
      }
      if (/^create\s+table\s+(?:if\s+not\s+exists\s+)?lighthouse\.gap_reports\b/i.test(statement)) {
        state.gapReportsExists = true;
        state.gapReportsMetadataTypeConstrained = hasGapReportsMetadataTypeConstraint(statement);
        continue;
      }
      if (/^drop\s+table\s+(?:if\s+exists\s+)?lighthouse\.gap_reports\b/i.test(statement)) {
        state.gapReportsExists = false;
        state.gapReportsMetadataTypeConstrained = false;
        continue;
      }
      if (!/^alter\s+table\s+(?:if\s+exists\s+)?lighthouse\.gap_reports\b/i.test(statement)) {
        continue;
      }
      if (
        /\bdrop\s+constraint\s+(?:if\s+exists\s+)?gap_reports_metadata_type_check\b/i.test(
          statement,
        )
      ) {
        state.gapReportsMetadataTypeConstrained = false;
      }
      if (
        /\badd\s+constraint\s+gap_reports_metadata_type_check\b/i.test(statement) &&
        hasGapReportsMetadataTypeConstraint(statement)
      ) {
        state.gapReportsMetadataTypeConstrained = true;
      }
    }
  }

  return state;
}
