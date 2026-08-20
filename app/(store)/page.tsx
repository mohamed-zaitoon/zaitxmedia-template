"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Bell, Boxes, Check, ChevronLeft, Gamepad2, PackageCheck, ShoppingBag, Sparkles, Wallet, WalletCards, Zap } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../lib/auth-context";
import { TikTokOfficialLogo, FacebookOfficialLogo, InstagramOfficialLogo, PubgOfficialLogo } from "../components/ServiceLogos";

export default function LandingPage() {
  const [isAdminHost, setIsAdminHost] = useState<boolean | null>(null);
  const { loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setIsAdminHost(
      window.location.hostname === "admin.zaitxmedia.com" ||
        window.location.hostname === "admin.zaitxmedia.test",
    );
  }, []);

  if (isAdminHost === null || loading) {
    return (
      <main className="premium-loader-container">
        <div className="premium-loader-wrapper">
          <div className="premium-loader"></div>
          <div className="premium-loader-inner"></div>
        </div>
        <span className="premium-loader-text">جاري التحميل...</span>
      </main>
    );
  }

  if (isAdminHost) {
    router.replace("/admin");
    return null;
  }

  const categories = [
    {
      href: "/tiktok",
      title: "شحن تيك توك",
      description: "عملات وخدمات تيك توك بتنفيذ سريع وآمن",
      color: "from-pink-500/20 to-cyan-400/10",
      icon: <TikTokOfficialLogo size={32} />,
    },
    {
      href: "/games",
      title: "شحن الألعاب",
      description: "اشحن ألعابك المفضلة بأفضل الأسعار",
      color: "from-amber-500/20 to-orange-400/10",
      icon: <PubgOfficialLogo size={32} />,
    },
    {
      href: "/facebook",
      title: "خدمات فيسبوك",
      description: "حلول نمو وتفاعل لحسابات وصفحات فيسبوك",
      color: "from-blue-500/20 to-sky-400/10",
      icon: <FacebookOfficialLogo size={32} />,
    },
    {
      href: "/instagram",
      title: "خدمات إنستجرام",
      description: "متابعون وتفاعل وخدمات حسابات إنستجرام",
      color: "from-fuchsia-500/20 to-purple-400/10",
      icon: <InstagramOfficialLogo size={32} />,
    },
    {
      href: "/other",
      title: "أخرى",
      description: "برامج وخدمات رقمية متنوعة",
      color: "from-emerald-500/20 to-teal-400/10",
      icon: <Boxes size={28} className="text-emerald-400" />,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-16 pb-8 md:gap-24">
      <section className="home-hero relative overflow-hidden rounded-[28px] border border-white/[0.08]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,#0e1c31_0%,#07101f_48%,#071521_100%)]" />
        <div className="absolute -right-32 -top-52 h-[520px] w-[520px] rounded-full bg-cyan-400/10 blur-[100px]" />
        <div className="absolute -bottom-60 left-0 h-[480px] w-[480px] rounded-full bg-blue-500/10 blur-[100px]" />
        <div className="relative grid min-h-[590px] items-center gap-14 px-7 py-14 sm:px-11 lg:grid-cols-[1.05fr_.95fr] lg:gap-20 lg:px-16 lg:py-16">
          <div className="max-w-2xl space-y-7">
            <h2 className="text-4xl font-black leading-[1.28] tracking-[-.03em] text-white sm:text-5xl lg:text-[64px]">
              خدماتك الرقمية
              <span className="mt-1 block bg-gradient-to-l from-cyan-300 via-primary to-blue-400 bg-clip-text text-transparent">
                أسرع. أوضح. أأمن.
              </span>
            </h2>
            <p className="max-w-xl text-sm leading-8 text-slate-400 sm:text-base">
              اشحن تيك توك والألعاب واطلب خدمات السوشيال من لوحة واحدة، بسعر واضح ومتابعة مباشرة من الدفع حتى اكتمال التنفيذ.
            </p>
            <div className="flex flex-col gap-3.5 sm:flex-row">
              <Link href="/recharge" className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 px-8 font-black text-slate-950 shadow-[0_14px_35px_rgba(245,158,11,.25)] transition hover:-translate-y-1 hover:brightness-110 active:scale-95 cursor-pointer text-base">
                <Wallet size={20} className="fill-slate-950" /> ⚡ شحن الرصيد
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-7 gap-y-3.5 pt-1 text-xs font-semibold text-slate-400">
              {["دفع موثوق", "تسعير مباشر", "دعم ومتابعة"].map((item) => (
                <span key={item} className="flex items-center gap-2"><Check size={15} className="text-emerald-400" />{item}</span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[540px] lg:mr-auto">
            <div className="absolute -inset-5 rounded-[36px] bg-gradient-to-br from-cyan-500/20 via-primary/10 to-blue-500/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[32px] border border-white/15 bg-[#091321]/95 p-7 sm:p-9 shadow-[0_35px_90px_rgba(0,0,0,.5)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-6 pt-2">
                <div className="flex flex-col gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 text-xs font-black text-cyan-400 w-max shadow-sm">
                    ⚡ اختيار سريع
                  </span>
                  <h3 className="text-2xl font-black text-white leading-snug tracking-tight">ابدأ خدمتك الآن</h3>
                </div>
                <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 text-cyan-400 shadow-md">
                  <Sparkles size={24} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:gap-5">
                {categories.map((category, index) => {
                  const accents = ["text-pink-400 bg-pink-400/15 border-pink-400/20", "text-amber-400 bg-amber-400/15 border-amber-400/20", "text-blue-400 bg-blue-400/15 border-blue-400/20", "text-fuchsia-400 bg-fuchsia-400/15 border-fuchsia-400/20", "text-emerald-400 bg-emerald-400/15 border-emerald-400/20"];
                  return (
                    <Link
                      key={category.href}
                      href={category.href}
                      className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:bg-white/[0.08] hover:shadow-lg hover:shadow-cyan-500/10 flex flex-col justify-between"
                    >
                      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl border ${accents[index]} shadow-sm`}>
                        {category.icon}
                      </div>
                      <div className="space-y-2">
                        <strong className="block text-base font-bold text-white leading-snug">{category.title}</strong>
                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-cyan-400 group-hover:translate-x-1 transition-transform">
                          اختيار <ChevronLeft size={14} />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-6 flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 backdrop-blur-md">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                  <Bell size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <strong className="block text-sm font-bold text-white">إشعارات فورية</strong>
                  <span className="text-xs text-slate-400 block mt-0.5">نعرفك بكل تحديث على طلبك لحظة بلحظة</span>
                </div>
                <span className="shrink-0 h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_14px_#34d399] animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-black text-primary">كل ما تحتاجه</span>
            <h3 className="mt-2 text-3xl font-black text-white md:text-4xl">اختر القسم وابدأ</h3>
          </div>
          <p className="max-w-md text-sm leading-7 text-muted-foreground">خدمات مرتبة بوضوح لتصل لما تحتاجه بسرعة، مع إظهار السعر قبل تأكيد الطلب.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {categories.map((category, index) => {
            const gradients = [
              "from-pink-500/15 via-slate-900/70 to-cyan-500/10",
              "from-amber-500/15 via-slate-900/70 to-orange-500/8",
              "from-blue-500/15 via-slate-900/70 to-cyan-500/8",
              "from-fuchsia-500/15 via-slate-900/70 to-purple-500/8",
              "from-emerald-500/15 via-slate-900/70 to-teal-500/8",
            ];
            const iconColors = ["text-pink-400", "text-amber-400", "text-blue-400", "text-fuchsia-400", "text-emerald-400"];
            return (
              <Link key={category.href} href={category.href} className={`group relative min-h-[270px] overflow-hidden rounded-3xl border border-white/[0.075] bg-gradient-to-br ${gradients[index]} p-7 transition duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-2xl hover:shadow-black/30`}>
                <span className="absolute left-5 top-5 text-6xl font-black text-white/[0.025]">0{index + 1}</span>
                <div className="mb-12 flex h-13 w-13 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.055]">{category.icon}</div>
                <h4 className="text-xl font-black text-white">{category.title}</h4>
                <p className="mt-3 text-sm leading-7 text-slate-400">{category.description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-primary">عرض الخدمات <ArrowLeft size={16} className="transition group-hover:-translate-x-1.5" /></span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="premium-surface rounded-[28px] p-6 sm:p-9 lg:p-12">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <span className="text-xs font-black text-primary">تجربة بسيطة</span>
            <h3 className="mt-2 text-3xl font-black leading-tight text-white">من اختيار الخدمة إلى التنفيذ في 3 خطوات</h3>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">بدون رسائل مبهمة أو خطوات معقدة. كل شيء ظاهر داخل حسابك.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [ShoppingBag, "01", "اختر الخدمة", "حدد الخدمة والكمية المطلوبة"],
              [WalletCards, "02", "ادفع بأمان", "اشحن رصيدك بالطريقة المناسبة"],
              [BadgeCheck, "03", "تابع التنفيذ", "يصلك إشعار عند كل تحديث"],
            ].map(([StepIcon, number, title, text]) => {
              const Icon = StepIcon as typeof ShoppingBag;
              return (
                <div key={String(number)} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
                  <div className="mb-6 flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={19} /></div><span className="font-mono text-xs text-slate-600">{String(number)}</span></div>
                  <strong className="block text-sm text-white">{String(title)}</strong>
                  <span className="mt-2 block text-xs leading-6 text-muted-foreground">{String(text)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#091321]/60 p-6 sm:p-9">
        <h2 className="text-2xl font-black text-white mb-4">
          شحن عملات تيك توك بأرخص الأسعار | ZAITX MEDIA
        </h2>
        <p className="text-sm leading-8 text-slate-300 mb-4">
          أهلاً بك في منصة <strong>ZAITX MEDIA</strong> (زايتكس ميديا) — المنصة الأولى والأسرع في الوطن العربي لشحن عملات وكوينز تيك توك وشحن الألعاب بأسعار منافسة وتسليم فوري 100%. نوفر لك أفضل تجربة شحن عملات تيك توك عبر وسائل دفع متعددة تشمل فودافون كاش، انستاباي، وبرق في مصر والسعودية وكافة دول الخليج.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
            <strong className="block text-sm text-primary mb-1">شحن عملات تيك توك</strong>
            شحن كوينز وعملات تيك توك بأفضل شرائح التسعير المباشرة وبدون أي عمولات خفية.
          </div>
          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
            <strong className="block text-sm text-primary mb-1">شحن الألعاب والخدمات</strong>
            شحن ألعاب، جواهر، وخدمات السوشيال ميديا بسرعة فائقة وأعلى مستويات الأمان.
          </div>
          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
            <strong className="block text-sm text-primary mb-1">تسليم فوري ومباشر</strong>
            نظام شحن تلقائي مع متابعة حية لجميع طلباتك لحظة بلحظة.
          </div>
        </div>
      </section>
    </div>
  );
}
