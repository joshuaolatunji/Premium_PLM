import {RouterProvider} from "react-router-dom";
import { MotionConfig } from "motion/react";
import router from "./app/router";
import TooltipLayer from "./components/common/TooltipLayer";
import AppToaster from "./components/common/AppToaster";



function App() {
  return (
    // reducedMotion="user": every motion animation turns into a plain fade
    // (no movement) for anyone who prefers reduced motion.
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
      <TooltipLayer />
      <AppToaster />
    </MotionConfig>
  );
}

export default App;
