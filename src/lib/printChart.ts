/* Printing the portfolio chart.

   The chart on its own is a picture of where everything sits, which is what a room full of
   people wants on a page — but a picture is not a handout. Somebody reading it afterwards
   needs to know which dot was which, what each one is worth and how far along it is, and no
   amount of labelling gets four numbers onto a circle. So the printed chart carries a table
   under it: every project on the plot, in the order the chart ranks them.

   Landscape, because the chart is half again as wide as it is tall and a portrait page would
   spend its width on margins. `@page` cannot be written against a class, which is why the
   rule is put in at the moment of printing and taken out again after — printed or cancelled,
   either way the screen is as it was. */

const STYLE_ID = 'chart-print-page';

function cleanUp() {
  document.getElementById(STYLE_ID)?.remove();
  delete document.documentElement.dataset.print;
}

/**
 * Print the portfolio chart, and the table of what is on it, as a landscape PDF.
 *
 * @param done Run when the print dialog closes, to put the screen back as it was.
 */
export function printChart(done: () => void) {
  cleanUp();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = '@page { size: A4 landscape; margin: 12mm; }';
  document.head.append(style);
  document.documentElement.dataset.print = 'chart';

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
