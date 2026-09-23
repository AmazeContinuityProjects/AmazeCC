export type OfficialOdRecord = {
    slNo: string,
    type: string,
    reason: string,
    basis: string,
    date: string,
    time: string,
    remarks: string,
}

export type OfficialOdResponse = {
    success: boolean,
    semesterId: string,
    totalCount: number,
    note: string | null,
    records: OfficialOdRecord[],
    error?: string,
    message?: string,
}
