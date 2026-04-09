import { setPublishField } from "@/lib/features/createTestSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { DatePicker, TimePicker } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useState } from "react";

const getDateValue = (value: string) => (value ? dayjs(value) : null);

const getTimeValue = (value: string) => (value ? dayjs(`2026-01-01T${value}`) : null);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" stroke="#49734F" strokeWidth="1.2" />
    <path d="M1.5 6.5H14.5" stroke="#49734F" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M5.5 1.5V4.5" stroke="#49734F" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M10.5 1.5V4.5" stroke="#49734F" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6.4" stroke="#49734F" strokeWidth="1.2" />
    <path d="M8 4.8V8L10.4 9.6" stroke="#49734F" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PublishSchedule = () => {
  const dispatch = useAppDispatch();
  const publishState = useAppSelector((state) => (state.createTest as CreateTestState).publishState);

  const updateDateField = useCallback(
    (field: "scheduleDate" | "endingDate", value: Dayjs | null) => {
      dispatch(
        setPublishField({
          field,
          value: value ? value.format("YYYY-MM-DD") : "",
        }),
      );
    },
    [dispatch],
  );

  const updateTimeField = useCallback(
    (field: "scheduleTime" | "endingTime", value: Dayjs | null) => {
      dispatch(
        setPublishField({
          field,
          value: value ? value.format("HH:mm") : "",
        }),
      );
    },
    [dispatch],
  );

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
            value={getDateValue(publishState.scheduleDate)}
            format="MMM DD, YYYY"
            // open={openPicker === "scheduleDate"}
            // onOpen={() => setOpenPicker("scheduleDate")}
            // onClose={() => setOpenPicker(null)}
            onChange={(value) => updateDateField("scheduleDate", value)}
            slots={{ openPickerIcon: CalendarIcon }}
            slotProps={pickerSx("scheduleDate")}
          />
          <TimePicker
            value={getTimeValue(publishState.scheduleTime)}
            format="hh:mm A"
            // open={openPicker === "scheduleTime"}
            // onOpen={() => setOpenPicker("scheduleTime")}
            // onClose={() => setOpenPicker(null)}
            onChange={(value) => updateTimeField("scheduleTime", value)}
            slots={{ openPickerIcon: ClockIcon }}
            slotProps={pickerSx("scheduleTime")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">Test ending by</p>
        <div className="flex gap-3">
          <DatePicker
            value={getDateValue(publishState.endingDate)}
            format="MMM DD, YYYY"
            // open={openPicker === "endingDate"}
            // onOpen={() => setOpenPicker("endingDate")}
            // onClose={() => setOpenPicker(null)}
            onChange={(value) => updateDateField("endingDate", value)}
            slots={{ openPickerIcon: CalendarIcon }}
            slotProps={pickerSx("endingDate")}
          />
          <TimePicker
            value={getTimeValue(publishState.endingTime)}
            format="hh:mm A"
            // open={openPicker === "endingTime"}
            // onOpen={() => setOpenPicker("endingTime")}
            // onClose={() => setOpenPicker(null)}
            onChange={(value) => updateTimeField("endingTime", value)}
            slots={{ openPickerIcon: ClockIcon }}
            slotProps={pickerSx("endingTime")}
          />
        </div>
      </div>
    </>
  );
};

export default PublishSchedule;
