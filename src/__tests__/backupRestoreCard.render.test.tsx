import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getDefaultStore } from "jotai";
import { demoModeAtom, isLoggedInAtom } from "../store";

const getCloudBackupInfo = vi.fn();
const uploadCloudBackup = vi.fn();
const restoreCloudBackup = vi.fn();
const deleteCloudBackup = vi.fn();

vi.mock("@/lib/cloudBackup", () => ({
  getCloudBackupInfo: () => getCloudBackupInfo(),
  uploadCloudBackup: (passphrase: string) => uploadCloudBackup(passphrase),
  restoreCloudBackup: (passphrase: string) => restoreCloudBackup(passphrase),
  deleteCloudBackup: () => deleteCloudBackup(),
}));

import BackupRestoreCard from "../components/custom/profile/BackupRestoreCard";

describe("BackupRestoreCard cloud backup", () => {
  beforeEach(() => {
    getCloudBackupInfo.mockReset();
    uploadCloudBackup.mockReset();
    restoreCloudBackup.mockReset();
    deleteCloudBackup.mockReset();
    getDefaultStore().set(isLoggedInAtom, true);
    getDefaultStore().set(demoModeAtom, false);
  });

  afterEach(() => {
    cleanup();
    getDefaultStore().set(isLoggedInAtom, false);
    getDefaultStore().set(demoModeAtom, false);
  });

  it("requires a matching confirmation before creating the first encrypted cloud copy", async () => {
    getCloudBackupInfo.mockResolvedValue({ envelope: null, updatedAt: null });
    uploadCloudBackup.mockResolvedValue("2026-11-10T10:00:00.000Z");
    render(<BackupRestoreCard />);

    fireEvent.change(screen.getByLabelText("Cloud backup passphrase"), { target: { value: "long enough" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Back up to cloud" })));
    expect(getCloudBackupInfo).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Confirm passphrase")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Confirm passphrase"), { target: { value: "long enough" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirm and back up" })));
    expect(uploadCloudBackup).toHaveBeenCalledWith("long enough");
    expect(screen.getByText(/Last cloud backup:/)).toBeTruthy();
  });

  it("does not enable cloud backup in demo mode or while signed out", () => {
    getDefaultStore().set(isLoggedInAtom, false);
    getDefaultStore().set(demoModeAtom, true);
    render(<BackupRestoreCard />);
    expect(screen.getByText(/Sign in to VTOP to use cloud backup/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back up to cloud" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Restore from cloud" }).hasAttribute("disabled")).toBe(true);
  });

  it("asks for confirmation before restoring a cloud copy", async () => {
    getCloudBackupInfo.mockResolvedValue({ envelope: { ciphertext: "x" }, updatedAt: "2026-11-10T10:00:00.000Z" });
    restoreCloudBackup.mockResolvedValue(3);
    render(<BackupRestoreCard />);

    fireEvent.change(screen.getByLabelText("Cloud backup passphrase"), { target: { value: "long enough" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Restore from cloud" })));
    expect(screen.getByText(/Restore and replace matching data/)).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Restore and reload" })));
    expect(restoreCloudBackup).toHaveBeenCalledWith("long enough");
  });
});

describe("BackupRestoreCard first upload", () => {
  beforeEach(() => {
    getCloudBackupInfo.mockReset();
    uploadCloudBackup.mockReset();
    getDefaultStore().set(isLoggedInAtom, true);
    getDefaultStore().set(demoModeAtom, false);
  });
  afterEach(() => {
    cleanup();
    getDefaultStore().set(isLoggedInAtom, false);
  });

  it("still asks to confirm the passphrase when the account was checked earlier", async () => {
    getCloudBackupInfo.mockResolvedValue({ envelope: null, updatedAt: null });
    uploadCloudBackup.mockResolvedValue("2026-11-10T10:00:00.000Z");
    render(<BackupRestoreCard />);
    fireEvent.change(screen.getByLabelText("Cloud backup passphrase"), { target: { value: "long enough" } });

    // Restore first: finds no backup, marks the account as checked.
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Restore from cloud" })));
    expect(screen.getByText(/no cloud backup for this account yet/)).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Back up to cloud" })));
    expect(uploadCloudBackup).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Confirm passphrase")).toBeTruthy();
  });

  it("keeps the real error when checking the cloud fails", async () => {
    getCloudBackupInfo.mockRejectedValue(new Error("The cloud backup service isn't available right now."));
    render(<BackupRestoreCard />);
    fireEvent.change(screen.getByLabelText("Cloud backup passphrase"), { target: { value: "long enough" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Restore from cloud" })));
    expect(screen.getByText(/isn't available right now/)).toBeTruthy();
    expect(screen.queryByText(/no cloud backup for this account yet/)).toBeNull();
  });
});
