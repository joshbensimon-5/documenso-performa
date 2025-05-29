import { Outlet } from 'react-router';
import { motion } from 'framer-motion';

import backgroundPattern from '@documenso/assets/images/background-pattern.png';

export default function Layout() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12 md:p-12 lg:p-24">
      <div>
        <div className="absolute inset-0 -z-10 overflow-hidden">
          {/* Background pattern */}
          <motion.div
            className="flex h-full w-full items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4, transition: { duration: 0.5, delay: 0.5 } }}
          >
            <img
              src={backgroundPattern}
              alt="background pattern"
              className="-ml-[50vw] -mt-[15vh] h-full scale-125 object-cover dark:contrast-[70%] dark:invert dark:sepia md:scale-150 lg:scale-[175%]"
            />
          </motion.div>
        </div>

        <div className="relative w-full">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
