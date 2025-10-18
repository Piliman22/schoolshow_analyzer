export declare enum NoteTypes {
    SINGLE = 0,// タップノーツ
    HOLD = 1,// ホールドノーツ
    FLICK = 2,// フリックノーツ
    TRACE = 3
}
export interface Flags {
    noteType: NoteTypes;
    r1: number;
    r2: number;
    l1: number;
    l2: number;
    width: number;
    positionRange: string;
}
export declare class Note {
    timing: number;
    holds: number[];
    uid: number;
    flags: Flags;
    rawFlags: number;
    constructor(timing: number, holds: number[], uid: number, flags: Flags, rawFlags: number);
    get noteTypeName(): string;
    get hasHolds(): boolean;
}
export declare function getFlags(val: number): Flags;
export declare class ChartAnalyzer {
    filePath: string;
    notes: Note[];
    bpms: any[];
    offset: number;
    beats: any[];
    constructor(jsonFilePath: string);
    loadChart(): boolean;
    analyzeNote(note: Note): {
        timing: number;
        uid: number;
        type: string;
        raw_flags: string;
        position: string;
        width: number;
        has_holds: boolean;
        hold_count: number;
        flags_detail: {
            note_type: NoteTypes;
            l1: number;
            r1: number;
            l2: number;
            r2: number;
        };
    };
    getStatistics(): {
        total_notes?: undefined;
        duration?: undefined;
        note_type_counts?: undefined;
        simultaneous_count?: undefined;
        bpm_info?: undefined;
        beat_info?: undefined;
        offset?: undefined;
    } | {
        total_notes: number;
        duration: number;
        note_type_counts: {
            Single: number;
            Hold: number;
            Flick: number;
            Trace: number;
        };
        simultaneous_count: number;
        bpm_info: any[];
        beat_info: any[];
        offset: number;
    };
    printAnalysis(maxNotes?: number): void;
    exportToCsv(outputPath: string): void;
}
export declare function main(): void;
//# sourceMappingURL=analyzer.d.ts.map