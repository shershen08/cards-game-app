import Card from './Card.svelte';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import '@testing-library/jest-dom/extend-expect';
import { tsCallSignatureDeclaration } from '@babel/types';

const Card.wrapCard = jest.fn();

test('<Card /> renders', () => {
    const wrapper = render(Card, { props: { symbol: './images/test.png' }});
    // expect(wrapper.getByText('0').tagName).toBe('BUTTON');
    // wrapper.debug();
    // expect(wrapper.querySe).toBe('BUTTON');

  })

test('<Card /> contents', () => {
  const {getByTestId } = render(Card, { props: { symbol: './images/test.png' }});
  const face = getByTestId('face-side');
  expect(face.tagName).toBe('DIV');
  expect(face.getElementsByTagName('img').length).toBe(1)
  expect(face.getElementsByTagName('img')[0].getAttribute('src')).toBe("./images/test.png")

  const bg = getByTestId('bg-side');
  expect(bg.tagName).toBe('DIV');
  expect(bg.getElementsByTagName('img').length).toBe(1)
  expect(bg.getElementsByTagName('img')[0].getAttribute('src')).toBe("assets/bg.png")

});

test('<Card /> click', async () => {

  const {getByTestId} = render(Card, { props: { symbol: './images/test.png' }});
  const card = getByTestId('card-wrapper');
  //expect(face.tagName).toBe('DIV');
  await fireEvent.click(card);

  expect(Card.wrapCard).toHaveBeenCalledTimes(1);

});