import MainLayout from "@/layouts/MainLayout";
import AboutHero from "@/components/about/AboutHero";
import { Link } from "react-router-dom";

const sections = [
    {
        id: "our-story",
        title: "Our story",
        description: "FitLink kết nối người muốn tập luyện với huấn luyện viên cá nhân. Chúng tôi hướng đến việc giúp bạn tìm được người đồng hành phù hợp với mục tiêu, lịch sinh hoạt và kinh nghiệm tập luyện của mình.",
    },
    {
        id: "our-team",
        title: "Meet the team",
        description: "Huấn luyện viên trên FitLink đồng hành cùng bạn trong quá trình tập luyện. Khám phá hồ sơ, chuyên môn và các gói tập để lựa chọn huấn luyện viên phù hợp.",
    },
    {
        id: "how-it-works",
        title: "How FitLink works",
        description: "Tìm huấn luyện viên, chọn gói tập phù hợp và đặt lịch. Sau đó, trao đổi với huấn luyện viên, tham gia các buổi tập và theo dõi quá trình tập luyện của bạn trên FitLink.",
    },
    {
        id: "our-values",
        title: "Our values",
        description: "Chúng tôi đề cao sự đồng hành, mục tiêu thực tế và thói quen bền vững. Mỗi người có một điểm xuất phát riêng; việc tập luyện cần phù hợp với nhu cầu và nhịp sống của bạn.",
    },
];

export default function AboutPage() {
    return (
        <MainLayout>
            <AboutHero />
            <div className="mx-auto w-full max-w-[1200px] px-6 py-16 md:px-10 lg:px-14">
                {sections.map(({ id, title, description }) => (
                    <section key={id} id={id} className="scroll-mt-32 border-b border-orange-100 py-12 first:pt-0 last:border-0">
                        <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
                        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-gray-600">{description}</p>
                        {id === "our-team" && (
                            <Link to="/list-pt" className="mt-6 inline-block rounded-full bg-orange-500 px-7 py-3 font-semibold text-white transition hover:bg-orange-600">
                                Khám phá huấn luyện viên
                            </Link>
                        )}
                    </section>
                ))}
            </div>
        </MainLayout>
    );
}
