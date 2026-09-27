import { GradientCanvas } from "@/components/home/gradient-canvas";
import { Hero } from "@/components/home/hero";

const HomePage = () => (
  <main className="bg-background relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-6 text-center">
    <GradientCanvas />
    <Hero />
  </main>
);

export default HomePage;
