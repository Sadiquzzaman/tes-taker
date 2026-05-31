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
    <div className="h-[328px] bg-white rounded-[8px]">
      <div className="w-full h-[264px] p-4 flex flex-col justify-between">
        <div className="w-full h-[120px] relative">
          <Image
            src={ImageList[index % ImageList.length]}
            alt="Class Image"
            fill
            className="w-full h-full object-cover rounded-[6px]"
          />
        </div>
        <p className="pt-2 font-[500] text-[16px] leading-[20px] tracking-[-0.02em] text-[#232A25]">
          {classItem.class_name}
        </p>
        <p className="pb-3 font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">
          Joined On -{" "}
          {classItem.joined_at ? new Date(classItem.joined_at).toLocaleString() : "N/A"}
        </p>
        <div className="flex justify-between items-center">
          <div className="w-[45%] flex gap-1">
            <div>
              <ClassStudentCardIconSVG width={16} />
            </div>
            <div>
              <p className="font-[400] text-[12px] leading-[16px] tracking-[-0.01em] text-[#232A25]">Student</p>
              <p className="mt-2 ml-1 font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25]">
                {/* {classItem.classStudents.length} */}
              </p>
            </div>
          </div>
          <div className="w-[45%] flex gap-1">
            <div>
              <ClassTestsTakenIconSVG width={16} />
            </div>
            <div>
              <p className="font-[400] text-[12px] leading-[16px] tracking-[-0.01em] text-[#232A25]">Tests taken</p>
              <p className="mt-2 ml-1 font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25]">
                {/* {classItem.total_test_taken} */}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full h-[64px] flex items-center justify-between p-4 border-t border-[#EFF0F3]">
        <div className="flex items-center gap-2 text-[#747775]">
          <button
            title="Share Class"
            className="w-8 h-8 flex justify-center items-center rounded-[8px] hover:bg-[#EFF0F3]"
            onClick={() => dispatch(setOpenShareClassModal(classItem))}
          >
            <ShareIconSVG width={16} />
          </button>
        </div>
        <Link href={`/classes/details/${classItem.id}`}>
          <button className="h-8 rounded-[8px] px-3 bg-white text-[#49734F] border border-[#49734F] hover:bg-[#49734F] hover:text-white focus:bg-[#49734F] focus:text-white font-[500] text-[12px] leading-[16px] tracking-[-0.02em] transition-colors">
            View Class
          </button>
        </Link>
      </div>
    </div>
  );
};

export default StudentClassCard;
