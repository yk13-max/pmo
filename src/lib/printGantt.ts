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
export const PRINT_GRID_WIDTH = 560;
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
 * Call it once the chart has been redrawn at its printing width. Nothing is measured: the
 * list is the width the print stylesheet gives it and the chart has just been drawn to what
 * is left, so the two come to the width of the page by construction. Measuring what is on
 * screen would only report how wide the window happens to be.
 *
 * @param done Run when the print dialog closes, to put the screen back as it was.
 */
export function printGantt(done: () => void) {
  cleanUp();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = '@page { size: A4 landscape; margin: 10mm; }';
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
