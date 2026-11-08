import axios from "@/api/axiosClient";

export async function calculateBMIAndSave(heightCm, weightKg, bmi) {
    const res = await axios.post(
        "/student/bmi",
        { heightCm, weightKg, bmi },
    );
    return res.data;
}
