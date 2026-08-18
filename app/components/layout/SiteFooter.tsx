import Link from "next/link";
import { ShieldCheck, FileText } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="mt-auto w-full border-t border-white/[0.07] bg-[#080d18]/70 backdrop-blur-sm">
      <div className="centered-app-frame site-footer-content flex flex-col items-center justify-center pt-9 text-center md:pb-10">
        <div className="flex w-full flex-wrap items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/privacy"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white transition-all hover:bg-white/10 sm:px-6 sm:text-sm"
          >
            <ShieldCheck size={16} className="text-[#38bdf8]" />
            سياسة الخصوصية
          </Link>
          <Link
            href="/terms"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white transition-all hover:bg-white/10 sm:px-6 sm:text-sm"
          >
            <FileText size={16} className="text-[#38bdf8]" />
            شروط الخدمة
          </Link>
        </div>

        <p className="mt-5 w-full text-center text-xs leading-6 text-[#8899b4] sm:text-sm">
          © {new Date().getFullYear()} ZAITX MEDIA. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  );
}
