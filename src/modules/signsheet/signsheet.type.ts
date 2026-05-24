export interface SignsheetRow {
    index:      number;
    userId:     number | null;
    userCode:   string | null;
    title:      string | null;
    fullName:   string | null;
    firstName:  string | null;
    lastName:   string | null;
    nationalId: string | null;
    roomCode:   string | null;
    rowNo:      number | null;
    colNo:      number | null;
    seatNo:     string | null;
}

export interface SignsheetCampaign {
    id:            number;
    name:          string | null;
    year_be:       string;
    campaign_size: string;
    site:          string | null;
    is_unlock:     boolean;
}

export interface SignsheetSession {
    id:           number;
    session_code: string;
    title:        string | null;
    exam_date:    string;
    day_no:       number;
}

export interface SignsheetPdfWorkerData {
    campaign:      SignsheetCampaign;
    session:       SignsheetSession;
    rows:          SignsheetRow[];
    totalCount:    number;
    examSubjects:  string; // วิชาในวันที่สอบ เช่น "กฎหมายอาญาและกฎหมายภาษาอังกฤษ"
    campaignLabel: string; // campaign_size + ปี เช่น "สนามใหญ่ 2571"
    sessionText:   string; // เช่น "ช่วงเช้า วันที่ 22 เมษายน พ.ศ. 2569"
}

export interface SignsheetPdfResult {
    filePath: string;
    fileName: string;
}
