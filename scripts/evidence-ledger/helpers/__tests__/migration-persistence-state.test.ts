import { describe, expect, it } from "vitest";
import { deriveResearchPersistenceState } from "../migration-persistence-state";

describe("deriveResearchPersistenceState", () => {
  it("starts with every retired persistence owner absent", () => {
    expect(deriveResearchPersistenceState([])).toEqual({
      documentsExists: false,
      gapReportsExists: false,
      gapReportsMetadataTypeConstrained: false,
    });
  });

  it("tracks the final table state instead of matching an earlier migration", () => {
    const state = deriveResearchPersistenceState([
      `
        create table lighthouse.documents (id uuid);
        create table lighthouse.gap_reports (
          metadata jsonb,
          constraint gap_reports_metadata_type_check
            check (metadata ->> 'type' = 'gap_network')
        );
      `,
      "drop table if exists lighthouse.documents;",
      `
        drop table if exists lighthouse.gap_reports;
        create table lighthouse.gap_reports (metadata jsonb);
      `,
    ]);

    expect(state).toEqual({
      documentsExists: false,
      gapReportsExists: true,
      gapReportsMetadataTypeConstrained: false,
    });
  });

  it("recognizes multiline DDL and ignores retired table text in comments", () => {
    const commentOnlyState = deriveResearchPersistenceState([
      `
        create table lighthouse.documents (id uuid);
        drop table if exists lighthouse.documents;
        -- Do not create table lighthouse.documents again.
      `,
    ]);
    const multilineDdlState = deriveResearchPersistenceState([
      `
        create table
          lighthouse.documents (id uuid);
      `,
    ]);

    expect(commentOnlyState.documentsExists).toBe(false);
    expect(multilineDdlState.documentsExists).toBe(true);
  });

  it("tracks metadata constraint removal and restoration in order", () => {
    const state = deriveResearchPersistenceState([
      `
        create table lighthouse.gap_reports (
          metadata jsonb,
          constraint gap_reports_metadata_type_check
            check (metadata ->> 'type' = 'gap_network')
        );
      `,
      `
        alter table lighthouse.gap_reports
          drop constraint if exists gap_reports_metadata_type_check;
        alter table lighthouse.gap_reports
          add constraint gap_reports_metadata_type_check
          check (metadata ->> 'type' = 'gap_network');
      `,
    ]);

    expect(state.gapReportsExists).toBe(true);
    expect(state.gapReportsMetadataTypeConstrained).toBe(true);
  });

  it("observes constraint removal as the final state before any later restoration", () => {
    const removed = deriveResearchPersistenceState([
      `
        create table lighthouse.gap_reports (
          metadata jsonb,
          constraint gap_reports_metadata_type_check
            check (metadata ->> 'type' = 'gap_network')
        );
        alter table lighthouse.gap_reports
          drop constraint gap_reports_metadata_type_check;
      `,
    ]);
    const added = deriveResearchPersistenceState([
      `
        create table lighthouse.gap_reports (metadata jsonb);
        alter table lighthouse.gap_reports
          add constraint gap_reports_metadata_type_check
          check (metadata ->> 'type' = 'gap_network');
      `,
    ]);

    expect(removed.gapReportsMetadataTypeConstrained).toBe(false);
    expect(added.gapReportsMetadataTypeConstrained).toBe(true);
  });

  it("does not treat DDL embedded later in another SQL statement as a transition", () => {
    const state = deriveResearchPersistenceState([
      `
        create table lighthouse.documents (id uuid);
        create table lighthouse.gap_reports (
          metadata jsonb,
          constraint gap_reports_metadata_type_check
            check (metadata ->> 'type' = 'gap_network')
        );
        select 'drop table lighthouse.documents';
        select 'drop table lighthouse.gap_reports';
        select 'alter table lighthouse.gap_reports drop constraint gap_reports_metadata_type_check';
      `,
    ]);

    expect(state).toEqual({
      documentsExists: true,
      gapReportsExists: true,
      gapReportsMetadataTypeConstrained: true,
    });
  });

  it("requires both the canonical constraint name and gap-network predicate", () => {
    const nameOnly = deriveResearchPersistenceState([
      `
        create table lighthouse.gap_reports (
          metadata jsonb,
          constraint gap_reports_metadata_type_check check (metadata is not null)
        );
      `,
    ]);
    const predicateOnly = deriveResearchPersistenceState([
      `
        create table lighthouse.gap_reports (
          metadata jsonb check (metadata ->> 'type' = 'gap_network')
        );
      `,
    ]);

    expect(nameOnly).toEqual({
      documentsExists: false,
      gapReportsExists: true,
      gapReportsMetadataTypeConstrained: false,
    });
    expect(predicateOnly.gapReportsMetadataTypeConstrained).toBe(false);
  });

  it("ignores commented and non-canonical DDL before applying exact table transitions", () => {
    const state = deriveResearchPersistenceState([
      `
        /*
          create table lighthouse.documents (id uuid);
          create table lighthouse.gap_reports (
            metadata jsonb,
            constraint gap_reports_metadata_type_check
              check (metadata ->> 'type' = 'gap_network')
          );
        */
        select 'create table lighthouse.documents';
        create table public.documents (id uuid);
        alter table public.gap_reports
          add constraint gap_reports_metadata_type_check
          check (metadata ->> 'type' = 'gap_network');
      `,
      `
        CREATE TABLE IF NOT EXISTS lighthouse.documents (id uuid);
        CREATE TABLE IF NOT EXISTS lighthouse.gap_reports (metadata jsonb);
        ALTER TABLE IF EXISTS lighthouse.gap_reports
          ADD CONSTRAINT gap_reports_metadata_type_check
          CHECK (metadata ->> 'type' = 'gap_network');
        DROP TABLE IF EXISTS lighthouse.gap_reports;
      `,
    ]);

    expect(state).toEqual({
      documentsExists: true,
      gapReportsExists: false,
      gapReportsMetadataTypeConstrained: false,
    });
  });

  it("does not restore the metadata constraint from an unrelated or malformed alter", () => {
    const state = deriveResearchPersistenceState([
      `
        create table lighthouse.gap_reports (metadata jsonb);
        alter table lighthouse.gap_reports
          add constraint gap_reports_metadata_type_check
          check (metadata ->> 'type' = 'other');
        alter table lighthouse.other
          add constraint gap_reports_metadata_type_check
          check (metadata ->> 'type' = 'gap_network');
      `,
    ]);

    expect(state.gapReportsExists).toBe(true);
    expect(state.gapReportsMetadataTypeConstrained).toBe(false);
  });
});
