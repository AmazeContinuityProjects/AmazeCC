
import { useEffect, useState } from "react";
import NoContentFound from "../NoContentFound";
import ExamSchedule from "./ScheduleDisplay";
import VitolDisplay, { VitolUserPassForm } from "./VitolDisplay";

export default function ScheduleSubTab({ data, handleScheduleFetch, onBack }) {
    return (
        <>
            <ExamSchedule data={data} handleScheduleFetch={handleScheduleFetch} onBack={onBack} />
            {/* {(username && password) ? (
                <VitolDisplay vitolData={vitolData} handleFetchVitol={handleFetchVitol} setVitolData={setVitolData} />
            ) : (
                <VitolUserPassForm handleFetchVitol={handleFetchVitol} />
            )} */}
        </>
    );
}