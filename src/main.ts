import 'zone.js';
import { HttpInterceptorFn, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { map } from 'rxjs';
import { AppComponent } from './app/app.component';

const unwrapServiceResponse: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    map((event) => {
      if (!(event instanceof HttpResponse) || !request.url.startsWith('/api/')) {
        return event;
      }

      const body = event.body;
      if (body && typeof body === 'object') {
        const envelope = body as { status?: unknown; data?: unknown; };
        if (envelope.status === 'SUCCESS' && 'data' in envelope) {
          return event.clone({ body: envelope.data });
        }
      }
      return event;
    }),
  );

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(withInterceptors([unwrapServiceResponse]))],
}).catch(console.error);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
