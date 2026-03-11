export default {
  editor: {
    label: { en: 'Admin Cart Builder' },
    icon: 'shopping-cart',
    categories: ['data'],
    deprecated: false,
  },
  properties: {
    supabaseUrl: {
      label: { en: 'Supabase URL' },
      type: 'Text',
      bindable: true,
      hidden: true,
      defaultValue: '',
    },
    supabaseAnonKey: {
      label: { en: 'Supabase Anon Key' },
      type: 'Text',
      bindable: true,
      hidden: true,
      defaultValue: '',
    },
    accessToken: {
      label: { en: 'Auth Token' },
      type: 'Text',
      bindable: true,
      hidden: true,
      defaultValue: '',
    },
    userId: {
      label: { en: 'User ID' },
      type: 'Text',
      bindable: true,
      hidden: true,
      defaultValue: '',
    },
    refreshTrigger: {
      label: { en: 'Refresh Trigger' },
      type: 'Text',
      bindable: true,
      hidden: true,
      defaultValue: '',
    },
  },
  triggerEvents: [
    {
      name: 'cartbuilder:cartCreated',
      label: { en: 'On Cart Created' },
      event: { cartId: '', customerId: '' },
    },
    {
      name: 'cartbuilder:cartDispatched',
      label: { en: 'On Cart Dispatched' },
      event: { cartId: '' },
    },
    {
      name: 'cartbuilder:error',
      label: { en: 'On Error' },
      event: { message: '' },
    },
  ],
};
