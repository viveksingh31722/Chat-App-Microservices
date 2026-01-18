"use client";
import axios from "axios";
import { Lock, Loader2, ArrowRight, ChevronLeft } from "lucide-react";
import { useSearchParams, useRouter, redirect } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import { useAppData, user_service } from "@/src/context/AppContext";
import Loading from "./Loading";
import toast from "react-hot-toast";

const VerifyOtp = () => {
  const {isAuth, setIsAuth, setUser, loading: userLoading, fetchChats, fetchUsers} = useAppData();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState<string>("");
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const router = useRouter();

  const searchParams = useSearchParams();
  const email: string = searchParams.get("email") || "";

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [timer]);

  // console.log(timer);

  const handleInputChange = (index: number, value: string): void => {
    if (value.length > 1) {
      return;
    }

    const newOpt = [...otp];
    newOpt[index] = value;
    setOtp(newOpt);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLElement>
  ): void => {
    if (e.key === "Backspace" && index > 0 && !otp[index]) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLElement>): void => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("Text");
    const digits = pastedData.replace(/\D/g, "").slice(0, 6);
    if (digits.length === 6) {
      const newOtp = digits.split("");
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
    }
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLElement>
  ): Promise<void> => {
    e.preventDefault();
    const optString = otp.join("");
    if (optString.length < 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }
    setError("");
    setIsLoading(true);

    try {
      const { data } = await axios.post(`${user_service}/api/v1/verify`, {
        email,
        otp: optString,
      });
      toast.success(data.message);
      Cookies.set("token", data.token, {
        expires: 15,
        secure: false,
        path: "/",
      });
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      setUser(data.user);
      setIsAuth(true);
      fetchChats();
      fetchUsers();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Something went wrong");
      } else {
        toast.error("Unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResendLoading(true);
    setError("");

    try {
      const { data } = await axios.post(`${user_service}/api/v1/login`, {
        email,
      });
      toast.success(data.message);
      setTimer(60); 
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Something went wrong");
      } else {
        toast.error("Unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if(userLoading) return <Loading />;

  if(isAuth){
    redirect("/chat");
  }
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 text-white">
      <div className="max-w-md w-sm">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
          <div className="text-center mb-8 relative">
            <button className="absolute top-0 left-0 p-2 text-gray-300 hover:text-white" onClick={() => router.push('/login')}>
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="mx-auto w-15 h-15 bg-blue-600 rounded-lg flex items-center justify-center mb-6 ">
              <Lock size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">
              Verify Your Email
            </h1>
            <p className="text-gray-300 text-sm">
              We have sent a 6-digit code to
            </p>
            <p className="text-blue-400 font-medium text-xs">{email}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-4 text-center"
              >
                Enter the 6-digit code below
              </label>
              <div className="flex justify-center in-checked: space-x-3">
                {otp.map((value, index) => (
                  <input
                    key={index}
                    type="text"
                    maxLength={1}
                    value={value}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index == 0 ? handlePaste : undefined}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    className="w-10 h-10 text-center text-xl font-bold bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                ))}
              </div>
            </div>
            {error && (
              <div className="bg-red-900 border border-red-700 rounded-lg p-3">
                <p className="text-red-300 text-sm text-center">{error}</p>
              </div>
            )}
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2 py-2 rounded-lg w-full disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>Verify</span>
                  <ArrowRight className="w-5 h-5" />
                </div>
              )}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm mb-4">
              Didn&apos;t receive the code?
            </p>
            {timer > 0 ? (
              <p className="text-gray-400 text-sm">
                Resend code in {timer} Seconds
              </p>
            ) : (
              <button className="text-blue-400 hover:text-blue-300 font-medium text-sm opacity-50 disabled = {resendLoading}" onClick={handleResendOtp}>
                {resendLoading ? "Sending..." : "Resend Code"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyOtp;
