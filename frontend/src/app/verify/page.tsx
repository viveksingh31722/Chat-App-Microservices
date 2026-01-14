
import Loading from "@/src/components/Loading";
import VerifyOtp from "@/src/components/VerifyOtp";
import { Suspense } from "react";

const VerifyPage = () => {
  return (
    <Suspense fallback={<Loading/> }>
      <VerifyOtp />
    </Suspense>
  );
};

export default VerifyPage;
