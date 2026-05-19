import { setPublishField } from "@/lib/features/createTestSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { DatePicker, TimePicker } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useState } from "react";
import ScheduleCalendarIconSVG from "@/component/svg/ScheduleCalendarIconSVG";
import ScheduleClockIconSVG from "@/component/svg/ScheduleClockIconSVG";

const PublishSchedule = () => {
  const dispatch = useAppDispatch();
  const publishState = useAppSelector((state) => (state.createTest as CreateTestState).publishState);

  const mergeToISO = (existingISO: string, newValue: Dayjs | null, type: "date" | "time") => {
    if (!newValue) return "";

    const base = existingISO ? dayjs(existingISO) : dayjs();

    if (type === "date") {
      return base.year(newValue.year()).month(newValue.month()).date(newValue.date()).toISOString();
    }

    if (type === "time") {
      return base.hour(newValue.hour()).minute(newValue.minute()).second(0).toISOString();
    }

    return base.toISOString();
  };

  const updateDateTime = (value: Dayjs | null, type: "date" | "time", field: "scheduleAt" | "endingAt") => {
    const updated = mergeToISO(publishState[field], value, type);

    dispatch(
      setPublishField({
        field,
        value: updated,
      }),
    );
  };

  const [openPicker, setOpenPicker] = useState<null | "scheduleDate" | "scheduleTime" | "endingDate" | "endingTime">(
    null,
  );

  const pickerSx = (value: "scheduleDate" | "scheduleTime" | "endingDate" | "endingTime") => ({
    textField: {
      onClick: () => setOpenPicker(value),
      sx: {
        width: "100%",
      },
      slotProps: {
        input: {
          sx: {
            fontWeight: 400,
            color: "#232A25",
            caretColor: "transparent",
            cursor: "pointer",
            borderRadius: "8px",
            height: "44px",
            borderColor: "#E5E5E5",
            "& fieldset": {
              borderColor: "#E5E5E5",
            },

            "&:hover fieldset": {
              borderColor: "#E5E5E5",
            },

            "&.Mui-focused fieldset": {
              borderColor: "#E5E5E5",
              borderWidth: "1px", // prevent thicker border on focus
            },
          },
        },
      },
    },
  });

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">
          Schedule Date &amp; Time
        </p>
        <div className="flex gap-3">
          <DatePicker
            value={publishState.scheduleAt ? dayjs(publishState.scheduleAt) : null}
            format="MMM DD, YYYY"
            // open={openPicker === "scheduleDate"}
            // onOpen={() => setOpenPicker("scheduleDate")}
            // onClose={() => setOpenPicker(null)}
            onChange={(value) => updateDateTime(value, "date", "scheduleAt")}
            slots={{ openPickerIcon: ScheduleCalendarIconSVG }}
            slotProps={pickerSx("scheduleDate")}
          />
          <TimePicker
            value={publishState.scheduleAt ? dayjs(publishState.scheduleAt) : null}
            format="hh:mm A"
            // open={openPicker === "scheduleTime"}
            // onOpen={() => setOpenPicker("scheduleTime")}
            // onClose={() => setOpenPicker(null)}
            onChange={(value) => updateDateTime(value, "time", "scheduleAt")}
            slots={{ openPickerIcon: ScheduleClockIconSVG }}
            slotProps={pickerSx("scheduleTime")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">Test ending by</p>
        <div className="flex gap-3">
          <DatePicker
            value={publishState.endingAt ? dayjs(publishState.endingAt) : null}
            format="MMM DD, YYYY"
            // open={openPicker === "endingDate"}
            // onOpen={() => setOpenPicker("endingDate")}
            // onClose={() => setOpenPicker(null)}
            onChange={(value) => updateDateTime(value, "date", "endingAt")}
            slots={{ openPickerIcon: ScheduleCalendarIconSVG }}
            slotProps={pickerSx("endingDate")}
          />
          <TimePicker
            value={publishState.endingAt ? dayjs(publishState.endingAt) : null}
            format="hh:mm A"
            // open={openPicker === "endingTime"}
            // onOpen={() => setOpenPicker("endingTime")}
            // onClose={() => setOpenPicker(null)}
            onChange={(value) => updateDateTime(value, "time", "endingAt")}
            slots={{ openPickerIcon: ScheduleClockIconSVG }}
            slotProps={pickerSx("endingTime")}
          />
        </div>
      </div>
    </>
  );
};

export default PublishSchedule;
