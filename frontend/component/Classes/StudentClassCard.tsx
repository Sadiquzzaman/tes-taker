import Image from "next/image";
import Link from "next/link";
import { useAppDispatch } from "@/lib/hooks";
import { setOpenShareClassModal } from "@/lib/features/classSlice";
import ShareIconSVG from "../svg/ShareIconSVG";
import ClassStudentCardIconSVG from "../svg/ClassStudentCardIconSVG";
import ClassTestsTakenIconSVG from "../svg/ClassTestsTakenIconSVG";

const ImageList = [
  "/assets/image/classImage/class_default.png",
  "/assets/image/classImage/class_default_2.png",
  "/assets/image/classImage/class_default_3.png",
  "/assets/image/classImage/class_default_4.png",
  "/assets/image/classImage/class_default_5.png",
];

const StudentClassCard = ({ classItem, index }: ClassCardProps<StudentClass>) => {
  const dispatch = useAppDispatch();

  return (
    <div className="h-[328px] bg-surface rounded-input">
      <div className="w-full h-[264px] p-4 flex flex-col justify-between">
        <div className="w-full h-[120px] relative">
          <Image
            src={ImageList[index % ImageList.length]}
            alt="Class Image"
            fill
            className="w-full h-full object-cover rounded-input"
          />
        </div>
        <p className="pt-2 font-medium text-body text-ink">
          {classItem.class_name}
        </p>
        <p className="pb-3 font-normal text-caption text-ink-muted">
          Joined On - {classItem.joined_at ? new Date(classItem.joined_at).toLocaleString() : "N/A"}
        </p>
        <div className="flex justify-between items-center">
          <div className="w-[45%] flex gap-1">
            <div>
              <ClassStudentCardIconSVG width={16} />
            </div>
            <div>
              <p className="font-normal text-caption text-ink">Student</p>
              <p className="mt-2 ml-1 font-semibold text-body text-ink">
                {/* {classItem.classStudents.length} */}
              </p>
            </div>
          </div>
          <div className="w-[45%] flex gap-1">
            <div>
              <ClassTestsTakenIconSVG width={16} />
            </div>
            <div>
              <p className="font-normal text-caption text-ink">Tests taken</p>
              <p className="mt-2 ml-1 font-semibold text-body text-ink">
                {/* {classItem.total_test_taken} */}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full h-[64px] flex items-center justify-between p-4 border-t border-border">
        <div className="flex items-center gap-2 text-ink-muted">
          <button
            title="Share Class"
            className="w-8 h-8 flex justify-center items-center rounded-input hover:bg-canvas"
            onClick={() => dispatch(setOpenShareClassModal(classItem))}
          >
            <ShareIconSVG width={16} />
          </button>
        </div>
        <Link href={`/classes/details/${classItem.id}`}>
          <button className="h-8 rounded-input px-3 bg-surface text-primary border border-primary hover:bg-primary hover:text-ink-inverse focus:bg-primary focus:text-ink-inverse font-medium text-caption transition-colors">
            View Class
          </button>
        </Link>
      </div>
    </div>
  );
};

export default StudentClassCard;
