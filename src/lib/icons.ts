import Icon, { addCollection } from '@iconify/svelte/dist/OfflineIcon.svelte';
import mdi from '#lib/icons.json';

// Icons ship in the bundle so the app never calls the Iconify API. Run `npm run icons` after adding one.
addCollection(mdi);

export default Icon;
