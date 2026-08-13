/* Printing the plan.

   The rest of the tracker prints as it reads: a portrait page, the screen's own layout, and
   the print stylesheet hiding the chrome. A Gantt cannot be printed that way. It is as wide
   as the project is long — a sixteen-month plan at the week zoom is nearly four thousand
   pixels of chart — so a portrait page would crop it at the first month that did not fit,
   and scaling the whole thing down to fit leaves type nobody can read.

   So printing a plan is its own drawing. The page turns on its side; the columns that are
   there for editing rather than reading are dropped, leaving the task, who has it, how long
   it takes and when it lands; and the chart is redrawn at whatever a day has to be worth for
   the whole plan to reach the right edge of the page. What is left is a plan somebody can be
   handed.

   The page itself has to be set at the moment of printing rather than in the stylesheet:
   `@page` cannot be written against a class. The style element carries it and goes again
   when the dialog closes — printed or cancelled, either way the screen is as it was. */

/** A4 landscape at 10mm margins, in the pixels a browser lays print out in. */
export const PRINT_PAGE_WIDTH = 1010;
/** What the task list takes on paper, once the editing columns have gone. */
export const PRINT_GRID_WIDTH = 500;
/** What is left for the chart, which is what a day has to be scaled to fill. */
export const PRINT_CHART_WIDTH = PRINT_PAGE_WIDTH - PRINT_GRID_WIDTH;

const STYLE_ID = 'gantt-print-page';

function cleanUp() {
  document.getElementById(STYLE_ID)?.remove();
  delete document.documentElement.dataset.print;
}

/**
 * Print the plan on screen as a landscape PDF.
 *
 * Call it once the chart has been redrawn at its printing width — the measurement here is of
 * what is actually on the page, and is only a safety net for a plan whose task names push the
 * list past the width it was given.
 *
 * @param workspace The element holding the task list and the chart side by side.
 * @param done Run when the print dialog closes, to put the screen back as it was.
 */
export function printGantt(workspace: HTMLElement | null, done: () => void) {
  cleanUp();
  /* The chart is measured because it has just been redrawn to fit; the list is taken as the
     width the print stylesheet gives it, which is not what it is showing on screen and so
     cannot be measured here. */
  const chart = workspace?.lastElementChild?.firstElementChild as HTMLElement | null;
  const full = PRINT_GRID_WIDTH + (chart?.offsetWidth ?? 0);
  const scale = full > PRINT_PAGE_WIDTH ? PRINT_PAGE_WIDTH / full : 1;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `@page { size: A4 landscape; margin: 10mm; }
    @media print { :root[data-print='gantt'] .plan-workspace { zoom: ${scale.toFixed(3)}; } }`;
  document.head.append(style);
  document.documentElement.dataset.print = 'gantt';

  const finish = () => {
    cleanUp();
    done();
  };
  /* Chrome fires this after the dialog closes either way; the timer is for the browsers that
     do not, so the screen is never left in the printing state. */
  window.addEventListener('afterprint', finish, { once: true });
  window.setTimeout(finish, 60_000);
  window.print();
}
