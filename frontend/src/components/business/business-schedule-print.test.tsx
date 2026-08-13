import { render, screen } from "@testing-library/react";
import { BusinessSchedulePrint, openBusinessSchedulePrint } from "./business-schedule-print";

it("renders an A4 schedule in the selected language with shifts and absences", () => {
  render(<BusinessSchedulePrint organizationName="Hotel Berlin" from="2026-08-10" to="2026-08-16" language="de"
    days={["2026-08-10","2026-08-11"]}
    members={[{id:"member-1",userId:"user-1",firstName:"Maria",lastName:"Test",email:"maria@example.com",status:"ACTIVE"}]}
    dayEntries={[{id:"day-1",membershipId:"member-1",date:"2026-08-11",type:"VACATION",notes:null,hasWorkConflict:false}]}
    requirements={[{id:"req-1",unitId:"unit-1",unitName:"Housekeeping",workTypeId:"type-1",code:"CAM",workTypeName:"Zimmer",color:"#10b981",date:"2026-08-10",startTime:"08:00:00",endTime:"16:30:00",requiredWorkers:1,assignedWorkers:1,coverageDifference:0,coverageStatus:"COVERED",publicationStatus:"PUBLISHED",checkInMode:"OPTIONAL",assignments:[{id:"assignment-1",membershipId:"member-1",memberName:"Maria Test",startTime:null,endTime:null,hasConflict:false,conflictingAssignmentIds:[],viewed:true,result:null}]}]}/>);

  expect(screen.getByRole("region", { name: "Wöchentlicher Dienstplan" })).toBeInTheDocument();
  expect(screen.getByText("Hotel Berlin")).toBeInTheDocument();
  expect(screen.getByText("Maria Test")).toBeInTheDocument();
  expect(screen.getByText("Urlaub")).toBeInTheDocument();
  expect(screen.getByText(/08:00–16:30 · Housekeeping/)).toBeInTheDocument();
});

it("opens the browser PDF dialog after the export modal closes", () => {
  vi.useFakeTimers();
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  openBusinessSchedulePrint();
  expect(print).not.toHaveBeenCalled();
  vi.advanceTimersByTime(50);
  expect(print).toHaveBeenCalledOnce();
  vi.useRealTimers();
});
